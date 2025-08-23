// app/routes/api.create-draft-order.jsx
import { json } from "@remix-run/node";
import { cors } from "remix-utils/cors";
import db from "../db.server";
import nodemailer from "nodemailer";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  console.log(
    `[${new Date().toISOString()}] Starting draft order creation for request to /api/create-draft-order`
  );

  try {
    // Parse body FIRST (so we can extract shop param if needed)
    let body;
    try {
      body = await request.json();
    } catch {
      throw new Error("Invalid JSON in request body");
    }
    const { customer, cart, address, billingAddress, useShipping, shop: shopFromBody } = body;
    if (!cart?.items?.length) throw new Error("Cart is empty");

    // Authenticate with session, fallback to DB if needed
    let session;
    try {
      const authResult = await authenticate.admin(request);
      session = authResult.session;
      console.log(
        `[${new Date().toISOString()}] Authentication successful for shop: ${session.shop}`
      );
    } catch (authError) {
      console.error(
        `[${new Date().toISOString()}] Authentication failed, trying DB fallback: ${authError.message}`
      );

      if (!shopFromBody) throw new Error("No shop param provided in body for DB fallback");

      const sessionRecord = await db.session.findFirst({ where: { shop: shopFromBody } });
      if (!sessionRecord) throw new Error("No DB session found");

      session = {
        shop: sessionRecord.shop,
        accessToken: sessionRecord.accessToken,
        scope: sessionRecord.scope,
      };
    }

    // Prefer session.shop, fallback to body.shop
    const shop = session?.shop || shopFromBody;
    const accessToken = session?.accessToken;
    if (!shop) throw new Error("No shop param provided (missing in session and body)");
    if (!accessToken) throw new Error("Missing access token for shop");

    // Load shop settings
    let setting = await db.setting.findUnique({ where: { shop } });
    if (!setting) {
      setting = await db.setting.create({
        data: {
          shop,
          doubleDraftOrdersEnabled: false,
          discount1: 0,
          discount2: 0,
          tag1: "",
          tag2: "",
          singleDiscount: 0,
          singleTag: "",
        },
      });
    }

    const adminGraphQLEndpoint = `https://${shop}/admin/api/2024-10/graphql.json`;
    const headers = {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    };

    // Build line items
    const lineItems = cart.items.map((item) => ({
      quantity: item.quantity,
      variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
    }));

    // Addresses
    const shippingAddress = {
      address1: address?.address1 || "",
      address2: address?.apartment || "",
      city: address?.city || "",
      province: address?.state || "",
      country: address?.country || "",
      company: address?.company || "",
      zip: address?.pin || "",
      firstName: customer?.first_name || "",
      lastName: customer?.last_name || "",
    };
    const billingAddressInput = useShipping
      ? shippingAddress
      : {
          address1: billingAddress?.address1 || "",
          address2: billingAddress?.apartment || "",
          city: billingAddress?.city || "",
          province: billingAddress?.state || "",
          country: billingAddress?.country || "",
          company: billingAddress?.company || "",
          zip: billingAddress?.pin || "",
          firstName: customer?.first_name || "",
          lastName: customer?.last_name || "",
        };

    // Draft order mutation
    const draftOrderMutation = `
      mutation createDraftOrder($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder {
      id
      name
      invoiceUrl
      createdAt
      totalPriceSet { shopMoney { amount currencyCode } }

      customer {
        id
        email
        firstName
        lastName
      }
      shippingAddress {
        firstName
        lastName
        address1
        address2
        city
        province
        country
        zip
        company
      }
      billingAddress {
        firstName
        lastName
        address1
        address2
        city
        province
        country
        zip
        company
      }

      lineItems(first: 250) {
        edges {
          node {
            title
            quantity
            variant {
              id
              title
              image { url }
            }
            originalUnitPriceSet {
              shopMoney { amount currencyCode }
            }
          }
        }
      }
    }
    userErrors { field message }
  }
}

    `;

    // Helper to create draft orders
    // Helper to create draft orders
const createDraft = async (discountAmount, discountLabel, tag) => {
 const input = {
  visibleToCustomer: false,
  lineItems,
  note: "Created via Draft App",
  tags: [tag].filter(Boolean),

  // ✅ Customer link (either by ID or by email)
  ...(customer?.id && {
    customerId: `gid://shopify/Customer/${customer.id}`,
  }),
  ...(!customer?.id && customer?.email && {
    email: customer.email,
  }),

  // ✅ Addresses
  shippingAddress,
  billingAddress: billingAddressInput,

  // ✅ Discount
  ...(discountAmount > 0 && {
    appliedDiscount: {
      title: discountLabel,
      description: discountLabel,
      value: parseFloat(discountAmount),
      valueType: "PERCENTAGE",
    },
  }),
};

  const res = await fetch(adminGraphQLEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: draftOrderMutation, variables: { input } }),
  });
  const data = await res.json();

  if (data.errors) throw new Error(JSON.stringify(data.errors));
  const userErrors = data.data.draftOrderCreate.userErrors;
  if (userErrors?.length) throw new Error(userErrors.map((e) => e.message).join(", "));

  return data.data.draftOrderCreate.draftOrder;
};

    // Create orders
    let createdOrders = [];
    if (setting.doubleDraftOrdersEnabled) {
      const draft1 = await createDraft(setting.discount1, "Discount 1", setting.tag1);
      const draft2 = await createDraft(setting.discount2, "Discount 2", setting.tag2);
      createdOrders = [draft1, draft2];
    } else {
      const draft = await createDraft(setting.singleDiscount, "Single Discount", setting.singleTag);
      createdOrders = [draft];
    }

    // Send confirmation email
    let emailSent = false;
    if (customer?.email) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const firstOrder = createdOrders[0];
        let summaryHTML = `
          <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#333;border:1px solid #e5e5e5;border-radius:8px;">
            <div style="padding:20px;">
              <h2>Hello ${customer.first_name || "Customer"}, your order is saved in draft orders</h2>
              <p>Good news! We've saved your order as a draft. You can review it now, and we'll be in touch shortly to finalize everything.</p>
            </div>
            <div style="border-top:1px solid #e5e5e5;padding:20px;">
              <h3>Order Summary</h3>
        `;

        let grandTotal = 0;
        firstOrder.lineItems.edges.forEach(({ node }) => {
          const price = parseFloat(node.originalUnitPriceSet.shopMoney.amount);
          const total = price * node.quantity;
          grandTotal += total;
          const currency = node.originalUnitPriceSet.shopMoney.currencyCode;
          const variantTitle =
            node.variant?.title && node.variant.title !== "Default Title"
              ? ` - ${node.variant.title}`
              : "";
          const imageUrl = node.variant?.image?.url || "https://via.placeholder.com/60";

          summaryHTML += `
            <div style="padding:10px 0;border-bottom:1px solid #e5e5e5;display:flex;align-items:center;gap:15px;">
              <img src="${imageUrl}" alt="${node.title}" width="50" height="50" style="border-radius:4px;border:1px solid #ddd;object-fit:cover;">
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:500;">${node.title}${variantTitle}</div>
                <div style="font-size:13px;color:#666;">× ${node.quantity}</div>
              </div>
              <div style="font-size:14px;font-weight:500;">${currency} ${total.toFixed(2)}</div>
            </div>
          `;
        });

        summaryHTML += `
            </div>
            <div style="padding:20px;border-top:1px solid #333;display:flex;justify-content:space-between;font-weight:bold;font-size:16px;">
              <span>Total</span>
              <span>${firstOrder.lineItems.edges[0]?.node.originalUnitPriceSet.shopMoney.currencyCode} ${grandTotal.toFixed(2)}</span>
            </div>
            <div style="background:#f8f8f8;padding:15px;text-align:center;font-size:12px;color:#777;">
              <p>Need help? Contact us at <a href="mailto:support@${shop}">support@${shop}</a></p>
              <p>&copy; ${new Date().getFullYear()} ${shop}. All rights reserved.</p>
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"${shop}" <${process.env.SMTP_USER}>`,
          to: customer.email,
          subject: "Your order is now in draft status",
          html: summaryHTML,
        });

        emailSent = true;
      } catch (e) {
        console.error("Email error:", e.message);
      }
    }

    // ✅ Response with CORS
    return await cors(
      request,
      json({ success: true, drafts: createdOrders, emailSent }),
      {
        origin: request.headers.get("Origin") || "*",
        methods: ["POST", "OPTIONS"],
        headers: ["Content-Type"],
      }
    );
  } catch (error) {
    console.error("Draft Order Error:", error.message);
    return await cors(
      request,
      json({ success: false, error: error.message }, { status: 500 }),
      {
        origin: request.headers.get("Origin") || "*",
        methods: ["POST", "OPTIONS"],
        headers: ["Content-Type"],
      }
    );
  }
}

export async function loader({ request }) {
  console.log(
    `[${new Date().toISOString()}] Loader handling method: ${request.method}`
  );

  // ✅ Preflight request, no auth needed
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("Origin");
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin",
      },
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
}
