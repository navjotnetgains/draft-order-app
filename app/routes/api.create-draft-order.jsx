import { json } from "@remix-run/node";
import { cors } from "remix-utils/cors";
import db from "../db.server";
import nodemailer from "nodemailer";
import { authenticate } from "../shopify.server";


export async function action({ request }) {

  try {
       const { session } = await authenticate.admin(request);

    const accessToken = session.accessToken;
    


    console.log("Access Token:", accessToken);
    // Authenticate the request
     const body = await request.json();
    const { customer, cart, address, billingAddress, useShipping, shop } = body;
    
    console.log("Shop from frontend:", shop);
    
    if (!shop) {
      throw new Error("Shop parameter is required");
    }

    if (!customer?.email) {
      throw new Error("Missing customer email");
    }

    // Use the shop from the frontend for the GraphQL endpoint
    const adminGraphQLEndpoint = `https://${shop}/admin/api/2024-01/graphql.json`;
    const headers = {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token":accessToken,
    };

    // Load settings
    const setting = await db.setting.findUnique({ where: { shop } });
    console.log(setting)
    if (!setting) {
      throw new Error("Settings not found for this shop");
    }
    // Find customer in Shopify
    const customerQuery = `
      query getCustomerByEmail($email: String!) {
        customers(first: 1, query: $email) {
          edges {
            node {
              id
              email
              firstName
              lastName
            }
          }
        }
      }
    `;
    const customerRes = await fetch(adminGraphQLEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: customerQuery,
        variables: { email: `email:${customer.email}` },
      }),
    });
    const customerData = await customerRes.json();
    if (customerData.errors) throw new Error("Customer query failed: " + JSON.stringify(customerData.errors));
    const foundCustomer = customerData?.data?.customers?.edges?.[0]?.node;
    if (!foundCustomer) throw new Error("Customer not found");

    // Prepare line items
    const lineItems = cart.items.map((item) => ({
      quantity: item.quantity,
      variantId: `gid://shopify/ProductVariant/${item.variant_id}`,
    }));

    // Prepare addresses
    const shippingAddress = {
      address1: address.address1,
      address2: address.apartment || "",
      city: address.city,
      province: address.state || "",
      country: address.country,
      company: address.company || "",
      zip: address.pin || "",
      firstName: customer.first_name,
      lastName: customer.last_name,
    };
    const billingAddressInput = {
      address1: billingAddress?.address1,
      address2: billingAddress?.apartment || "",
      city: billingAddress?.city,
      province: billingAddress?.state || "",
      country: billingAddress?.country,
      company: billingAddress?.company || "",
      zip: billingAddress?.pin || "",
      firstName: customer.first_name,
      lastName: customer.last_name,
    };

    // Draft Order mutation
    const draftOrderMutation = `
      mutation createDraftOrder($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
            invoiceUrl
            createdAt
            totalPriceSet { shopMoney { amount currencyCode } }
            lineItems(first: 250) {
              edges {
                node {
                  title
                  quantity
                  variant {
                    title
                    image {
                      originalSrc
                    }
                  }
                  originalUnitPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Create draft helper
    const createDraft = async (discountAmount, discountLabel, tag) => {
      const input = {
        customerId: foundCustomer.id,
        email: customer.email,
        visibleToCustomer: false,
        shippingAddress,
        billingAddress: billingAddressInput,
        lineItems,
        note: "Created via Draft App",
        tags: [tag],
        ...(discountAmount > 0 && {
          appliedDiscount: {
            title: discountLabel,
            description: discountLabel,
            value: parseFloat(discountAmount),
            valueType: "PERCENTAGE",
          }
        }),
      };

      const response = await fetch(adminGraphQLEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: draftOrderMutation,
          variables: { input },
        }),
      });

      const data = await response.json();
      if (data.errors) throw new Error("GraphQL Errors: " + JSON.stringify(data.errors));
      const userErrors = data?.data?.draftOrderCreate?.userErrors || [];
      if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(", "));
      const draftOrder = data.data.draftOrderCreate.draftOrder;
      console.log("Shopify returned line items:", JSON.stringify(draftOrder.lineItems, null, 2));
      return draftOrder;
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

    // ---- SEND CUSTOM CONFIRMATION EMAIL ----
    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    let summaryHTML = "";
    if (createdOrders.length > 0) {
      const firstOrder = createdOrders[0];
      let grandTotal = 0;

      summaryHTML += `
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#333;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
          
          <!-- Greeting -->
          <div style="padding:20px;">
            <h2 style="margin-top:0;color:#111;">Hello ${customer.first_name}, your order is saved in draft orders</h2>
            <p>Good news! We've saved your order as a draft. You can review it now, and we'll be in touch shortly to finalize everything.</p>
          </div>
          
          <!-- Items -->
          <div style="border-top:1px solid #e5e5e5;padding:20px;">
            <h3 style="margin-top:0;color:#111;">Order Summary</h3>
      `;

      firstOrder.lineItems.edges.forEach(({ node }) => {
        const price = parseFloat(node.originalUnitPriceSet.shopMoney.amount);
        const total = price * node.quantity;
        grandTotal += total;
        const currency = node.originalUnitPriceSet.shopMoney.currencyCode;
        const variantTitle = node.variant?.title && node.variant.title !== "Default Title"
          ? ` - ${node.variant.title}`
          : "";
        const imageUrl = node.variant?.image?.originalSrc || "https://via.placeholder.com/60";

        summaryHTML += `
          <div style="padding:10px 0; width:full;border-bottom:1px solid #e5e5e5;display:flex;align-items:center;justify-content:space-between;gap:15px;">
            
            <!-- Left: Image -->
            <img src="${imageUrl}" alt="${node.title}" width="50" height="50"
                 style="border-radius:4px;border:1px solid #ddd;object-fit:cover;flex-shrink:0;">
            
            <!-- Middle: Title + Qty -->
            <div style="flex:1;padding:0px 40px;">
              <div style="font-size:14px;font-color:gray;font-weight:500;color:#333;line-height:1.4;word-wrap:break-word;overflow-wrap:break-word;white-space:normal;">
                ${node.title}${variantTitle}
              </div>
              <div style="font-size:13px;color:#666;margin-top:2px;">
                × ${node.quantity}
              </div>
            </div>
            
            <!-- Right: Price -->
            <div style="font-size:14px;font-weight:500;color:#333;white-space:nowrap;">
              ${currency} ${total.toFixed(2)}
            </div>
          </div>
        `;
      });

      // Total
      summaryHTML += `
        </div>
        <div style="padding:20px;border-top:1px solid #333;display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:16px;">
          <span style="flex:1;text-align:left;">Total</span>
          <span style="text-align:right;">${firstOrder.lineItems.edges[0]?.node.originalUnitPriceSet.shopMoney.currencyCode} ${grandTotal.toFixed(2)}</span>
        </div>

        <!-- Footer -->
        <div style="background-color:#f8f8f8;padding:15px;text-align:center;font-size:12px;color:#777;">
          <p>Need help? Contact us at <a href="mailto:support@yourstore.com" style="color:#008060;">support@yourstore.com</a></p>
          <p>&copy; ${new Date().getFullYear()} Your Store. All rights reserved.</p>
        </div>
      </div>
      `;
    }

    await transporter.sendMail({
      from: `"Your Store" <${process.env.SMTP_USER}>`,
      to: customer.email,
      subject: "Your order is now in draft status",
      html: summaryHTML,
    });

    // Response
    return await cors(request, json({
      success: true,
      drafts: createdOrders,
      emailSent: true
    }), {
      origin: "*",
      methods: ["POST"],
      headers: ["Content-Type"],
    });

  } catch (error) {
    console.error("Draft Order Error:", error);
    return await cors(request, json({
      success: false,
      error: error.message
    }, { status: 500 }), {
      origin: "*",
      methods: ["POST"],
      headers: ["Content-Type"],
    });
  }
}

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  return new Response("Method Not Allowed", { status: 405 });
}