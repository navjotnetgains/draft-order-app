// app/routes/api.create-draft-order.jsx
import { json } from "@remix-run/node";
import { cors } from "remix-utils/cors";
import db from "../db.server";
import nodemailer from "nodemailer";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  console.log(`[${new Date().toISOString()}] Starting /api/create-draft-order`);

  let body;
  try {
    
    body = await request.json();
  } catch {
    return await sendError(request, "Invalid JSON in request body", 400);
  }

  const { customer, cart, address, billingAddress, useShipping, shop: shopFromBody } = body;
  if (!cart?.items?.length) return await sendError(request, "Cart is empty", 400);

  let shop, accessToken;

  // Step 1: Try normal Shopify authentication (preferred)
  try {
    const authResult = await authenticate.admin(request);
    shop = authResult.session.shop;
    accessToken = authResult.session.accessToken;
    console.log(`Authenticated via OAuth for shop: ${shop}`);
  } catch (authError) {
    console.warn("OAuth failed, falling back to DB token...", authError.message);

    // Step 2: Fallback to DB — but validate token first!
    if (!shopFromBody) {
      return await sendError(request, "Authentication failed and no shop provided in body", 401);
    }

    const sessionRecord = await db.session.findFirst({
      where: { shop: shopFromBody },
    });

    if (!sessionRecord?.accessToken) {
      return await sendError(
        request,
        "No valid session found. Please reinstall the app on your store.",
        401
      );
    }

    // Step 3: Validate the stored token is still working
    const testUrl = `https://${shopFromBody}/admin/api/2024-10/shop.json`;
    try {
      const testRes = await fetch(testUrl, {
        headers: {
          "X-Shopify-Access-Token": sessionRecord.accessToken,
        },
      });

      if (!testRes.ok) {
        const errorText = await testRes.text();
        console.error("Stored token invalid:", testRes.status, errorText);
        return await sendError(
          request,
          "Your app needs to be reinstalled. Access token is no longer valid. <a href='/auth?shop=" +
            shopFromBody +
            "'>Click here to reinstall</a>",
          401
        );
      }
    } catch (testErr) {
      console.error("Token test failed:", testErr.message);
      return await sendError(request, "Unable to validate access token. Please reinstall the app.", 401);
    }

    shop = sessionRecord.shop;
    accessToken = sessionRecord.accessToken;
    console.log(`Using valid stored token for ${shop}`);
  }

  if (!shop || !accessToken) {
    return await sendError(request, "Missing shop or access token", 500);
  }

  // Load or create settings
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

  const endpoint = `https://${shop}/admin/api/2024-10/graphql.json`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": accessToken,
  };

  const lineItems = cart.items.map((item) => ({
    quantity: item.quantity,
    variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
  }));

  const shippingAddress = {
    firstName: customer?.first_name || "",
    lastName: customer?.last_name || "",
    address1: address?.address1 || "",
    address2: address?.apartment || "",
    city: address?.city || "",
    province: address?.state || "",
    country: address?.country || "",
    zip: address?.pin || "",
    company: address?.company || "",
  };

  const billingAddressInput = useShipping
    ? shippingAddress
    : {
        firstName: customer?.first_name || "",
        lastName: customer?.last_name || "",
        address1: billingAddress?.address1 || "",
        address2: billingAddress?.apartment || "",
        city: billingAddress?.city || "",
        province: billingAddress?.state || "",
        country: billingAddress?.country || "",
        zip: billingAddress?.pin || "",
        company: billingAddress?.company || "",
      };

  const draftOrderMutation = `
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id name invoiceUrl createdAt
          totalPriceSet { shopMoney { amount currencyCode } }
          customer { id email firstName lastName }
          lineItems(first: 250) {
            edges {
              node {
                title quantity
                variant { id title image { url } }
                originalUnitPriceSet { shopMoney { amount currencyCode } }
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const createDraft = async (discount = 0, label = "Discount", tag = "") => {
    const input = {
      visibleToCustomer: false,
      lineItems,
      note: "Created via Draft Order App",
      tags: tag ? [tag] : [],
      shippingAddress,
      billingAddress: billingAddressInput,
      ...(customer?.id
        ? { customerId: `gid://shopify/Customer/${customer.id}` }
        : customer?.email
        ? { email: customer.email }
        : {}),
      ...(discount > 0 && {
        appliedDiscount: {
          title: label,
          description: label,
          value: parseFloat(discount),
          valueType: "PERCENTAGE",
        },
      }),
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: draftOrderMutation, variables: { input } }),
    });

    const data = await res.json();

    if (data.errors || data.data?.draftOrderCreate?.userErrors?.length) {
      const err = data.errors || data.data.draftOrderCreate.userErrors;
      throw new Error(JSON.stringify(err));
    }

    return data.data.draftOrderCreate.draftOrder;
  };

  try {
    let createdOrders = [];
    if (setting.doubleDraftOrdersEnabled) {
      // Create two orders only if both discounts are set > 0
      if (setting.discount1 > 0 && setting.discount2 > 0) {
        createdOrders.push(await createDraft(setting.discount1, "Discount Option 1", setting.tag1));
        createdOrders.push(await createDraft(setting.discount2, "Discount Option 2", setting.tag2));
      } else {
        // Fallback to single if double enabled but discounts not set
        createdOrders.push(await createDraft(setting.singleDiscount, "Your Discount", setting.singleTag));
      }
    } else {
      createdOrders.push(await createDraft(setting.singleDiscount, "Your Discount", setting.singleTag));
    }

   // Send Email
let emailSent = false;

if (customer?.email && process.env.SMTP_USER && process.env.SMTP_PASS) {
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

    const order = createdOrders[0];
    let itemsHtml = "";
    let total = 0;

    order.lineItems.edges.forEach(({ node }) => {
      const price = parseFloat(node.originalUnitPriceSet.shopMoney.amount);
      const lineTotal = price * node.quantity;
      total += lineTotal;
      const img = node.variant?.image?.url || "https://via.placeholder.com/80";

      itemsHtml += `
        <div style="display:flex; gap:16px; padding:12px 0; border-bottom:1px solid #eee;">
          <img src="${img}" width="60" height="60" style="object-fit:cover; border-radius:6px;">
          <div style="flex:1;">
            <div style="font-weight:600;">${node.title}</div>
            ${node.variant?.title !== "Default Title" ? `<div style="color:#666; font-size:14px;">${node.variant.title}</div>` : ""}
            <div style="color:#666; margin-top:4px;">Qty: ${node.quantity}</div>
          </div>
          <div style="font-weight:600;">${node.originalUnitPriceSet.shopMoney.currencyCode} ${lineTotal.toFixed(2)}</div>
        </div>`;
    });

    const currency = order.totalPriceSet.shopMoney.currencyCode;
    const orderTotal = parseFloat(order.totalPriceSet.shopMoney.amount).toFixed(2);

    const html = `... your email HTML ...`;

    await transporter.sendMail({
      from: `"${shop.replace(".myshopify.com", "")}" <${process.env.SMTP_USER}>`,
      to: customer.email,
      subject: "Your order is ready – complete payment anytime!",
      html,
    });

    emailSent = true;
  } catch (emailErr) {
    console.error("Email failed:", emailErr.message);
  }
}

    return await cors(
      request,
      json({ success: true, drafts: createdOrders, emailSent }),
      { origin: request.headers.get("Origin") || "*", methods: ["POST", "OPTIONS"] }
    );
  } catch (error) {
    console.error("Draft creation failed:", error.message);
    return await sendError(request, error.message, 500);
  }
}

// Helper to send consistent errors
async function sendError(request, message, status = 500) {
  return await cors(
    request,
    json({ success: false, error: message }, { status }),
    { origin: request.headers.get("Origin") || "*", methods: ["POST", "OPTIONS"] }
  );
}

// Handle CORS preflight
export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        Vary: "Origin",
      },
    });
  }
  return new Response("Method Not Allowed", { status: 405 });
}