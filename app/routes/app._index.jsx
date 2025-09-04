import { useLoaderData } from "@remix-run/react";
import db from "../db.server";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { Modal } from "@shopify/polaris";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  Badge,
  Banner,
  BlockStack,
  Button,
  InlineStack,
  Box
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { Link } from "@remix-run/react";

const styles = {
  button: {
    marginLeft: "10px",
    padding: "7px 11px",
    backgroundColor: "#1f1f20",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    textDecoration: "none",
    fontWeight: "600",
    fontSize: "12px",
    textAlign: "center",
    display: "inline-block",
  },
  featureCard: {
    flex: 1,
    minWidth: "300px",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  },
  metricsCard: {
    flex: 1,
    minWidth: "300px",
    padding: "20px",
    borderRadius: "12px",
    backgroundColor: "#f9fafb",
  },
  metricsText: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "#4f6e57ff",
    textAlign: "center",
  },
  stepCard: {
    backgroundColor: "#f9fafb",
    borderRadius: "12px",
    padding: "15px",
    marginBottom: "15px",
  },
  stepTitle: {
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "8px",
  },
  stepDescription: {
    fontSize: "13px",
    color: "#5c5f62",
  },
  featureTitle: {
    fontSize: "15px",
    fontWeight: "600",
    marginBottom: "8px",
  },
  featureDescription: {
    fontSize: "13px",
    color: "#5c5f62",
    marginBottom: "12px",
  },
  featureImage: {
    width: "48px",
    height: "48px",
    marginBottom: "12px",
  },
};

// SVG images as React components
const DraftOrderIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#E3F5FF" />
    <path d="M32 16H16V32H32V16Z" stroke="#006FBB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 20H28" stroke="#006FBB" strokeWidth="2" strokeLinecap="round" />
    <path d="M20 24H28" stroke="#006FBB" strokeWidth="2" strokeLinecap="round" />
    <path d="M20 28H24" stroke="#006FBB" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IntegrationIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#E0F0FF" />
    <path d="M24 32C28.4183 32 32 28.4183 32 24C32 19.5817 28.4183 16 24 16C19.5817 16 16 19.5817 16 24C16 28.4183 19.5817 32 24 32Z" stroke="#1A73E8" strokeWidth="2" />
    <path d="M24 16V8" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
    <path d="M24 40V32" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 24H8" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
    <path d="M40 24H32" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
    <path d="M30 18L36 12" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 30L12 36" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
    <path d="M30 30L36 36" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 18L12 12" stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const KnowledgeBaseIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#E6F4EA" />
    <path d="M24 32C28.4183 32 32 28.4183 32 24C32 19.5817 28.4183 16 24 16C19.5817 16 16 19.5817 16 24C16 28.4183 19.5817 32 24 32Z" stroke="#34A853" strokeWidth="2" />
    <path d="M24 28V24" stroke="#34A853" strokeWidth="2" strokeLinecap="round" />
    <path d="M24 20V20" stroke="#34A853" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const MetricsIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="6" fill="#F6F9FC" />
    <path d="M8 24V16" stroke="#4F6E57" strokeWidth="2" strokeLinecap="round" />
    <path d="M16 24V8" stroke="#4F6E57" strokeWidth="2" strokeLinecap="round" />
    <path d="M24 24V12" stroke="#4F6E57" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const { shop,accessToken } = session;

  const themesData = await fetchThemes(shop,accessToken);
  const publishedTheme = themesData.find((theme) => theme.role === "main") || {};


  if (!shop) throw new Error("Missing shop query param");

  let setting = await db.setting.findUnique({ where: { shop } });

  // if shop doesn’t have settings yet, create defaults
  if (!setting) {
    setting = await db.setting.create({
      data: { shop }, 
    });
  }

  // Fetch Draft Orders count
  const adminGraphQLEndpoint = `https://${shop}/admin/api/2025-07/graphql.json`;
  const headers = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": accessToken,
  };
  const draftOrdersQuery = `
    query {
      draftOrders(first: 100, query: "note:'Created via Draft App'") {
        edges { node { id } }
      }
    }
  `;
  const draftRes = await fetch(adminGraphQLEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: draftOrdersQuery }),
  });
  const draftData = await draftRes.json();
  const draftOrderCount = draftData?.data?.draftOrders?.edges?.length || 0;

  return json({
    setting,
    draftOrderCount,
    shop,
    publishedThemeId: publishedTheme.id || null,
  });
}

async function fetchThemes(shop, accessToken) {
  try {
    const response = await fetch(`https://${shop}/admin/api/2023-07/themes.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken, // ✅ Use session token, not env var
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch themes: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.themes || [];
  } catch (error) {
    console.error("Error fetching themes:", error);
    throw new Response("Failed to fetch themes", { status: 500 });
  }
}




export default function Dashboard() {
  const { setting, draftOrderCount, shop, publishedThemeId } = useLoaderData();

  const [active, setActive] = useState(false);
  const handleChange = useCallback(() => setActive(!active), [active]);

  const appEmbedUUID = "5bd368d8-c46d-43e5-9bae-352b44a42a35";
  const themeEditorUrl =
    shop && publishedThemeId
      ? `https://${shop}/admin/themes/${publishedThemeId}/editor?context=apps&appEmbed=${encodeURIComponent(
          `${appEmbedUUID}/draft_button`
        )}&previewPath=/cart`
      : "";

  const handleOpenThemeEditor = () => {
    if (!themeEditorUrl) {
      alert("Unable to open Theme Customizer. Please ensure the theme is published and try again.");
      return;
    }
    window.open(themeEditorUrl, "_blank");
  };

  return (
    <Page fullWidth>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <Box paddingBlockEnd="400">
          <Text variant="headingXl" as="h1" fontWeight="bold">
            Hi 👋, Welcome to Draft Order App
          </Text>
        </Box>
        <TitleBar title="Draft Order App Dashboard" />

        {/* 🔔 Yellow Warning Banner */}
        <div style={{ marginBottom: "13px" }}>
        <Banner
          title="Draft Order Button isn't showing up on your store yet"
          tone="warning"
        >
          <p>
            You activated Draft Order App but still need to enable the Draft Order button
            in the Shopify Theme Editor to complete installation.
          </p>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <Button onClick={handleOpenThemeEditor} variant="primary" >
              Enable Draft Order Button
            </Button>
            <Button variant="primary" onClick={handleChange}>Check Instructions</Button>
          </div>
        </Banner>
        </div>

        {/* 🪟 Modal with step instructions */}
     <Modal
  open={active}
  onClose={handleChange}
  title="Action required: Enable Draft Order Button"
   size="large" 
  primaryAction={{
    content: "Go to Theme Editor",
    onAction: handleOpenThemeEditor,
  }}
  secondaryActions={[
    {
      content: "Enable later",
      onAction: handleChange,
    },
  ]}
>
  <Modal.Section>
    <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
      {/* Left side instructions */}
      <div style={{ flex: 1 }}>
        <Text as="h2" variant="headingMd">
          Draft Order Button isn't showing up on your store yet
        </Text>
        <p style={{ margin: "10px 0" }}>
          Complete the installation by enabling the Draft Order Button in your
          Shopify Theme Editor.
        </p>
        <ol style={{ paddingLeft: "18px", lineHeight: "1.6" }}>
          <li>
            Search <b>Draft Order Button</b> in App embeds
          </li>
          <li>
            Click the <b>Enable</b> toggle
          </li>
          <li>
            Click the <b>Save</b> button
          </li>
        </ol>
      </div>

      {/* Right side image */}
      <div style={{ flex: 1 }}>
        <img
          src="/draft-order-instructions.png"
          alt="Enable Draft Order instructions"
          style={{
            width: "100%",
            borderRadius: "8px",
            objectFit: "contain",
            borderLeft:"3px solid black"
          }}
        />
      </div>
    </div>
  </Modal.Section>
</Modal>

        <TitleBar title="Draft Order App Dashboard" />
        <Layout>
          


          {/* Setup Steps Section */}
          <Layout.Section>
            <Card title="App Setup Steps" sectioned>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd" fontWeight="bold">
                    1. Enable the app
                  </Text>
                  <Text as="p" variant="bodyMd" color="subdued">
                    Go to Theme Customizer, App Embeds, and enable Draft Order Button App.
                  </Text>
                  <div style={{ marginTop: '8px' }}>
                    <Button
                      onClick={handleOpenThemeEditor}
                      size="medium"
                     variant="primary"
                    >
                      Open Theme Customizer
                    </Button>
                  </div>
                </BlockStack>

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm" fontWeight="bold">
                    2. Configure settings
                  </Text>
                  <Text as="p" variant="bodyMd" color="subdued">
                    Set up your draft order preferences including payment modes and discounts.
                  </Text>
                  <div style={{ marginTop: '8px' }}>
                    <Link to="/app/settings">
                      <Button
                        size="medium"
                        variant="primary"
                      >
                        Configure Settings
                      </Button>
                    </Link>
                  </div>
                </BlockStack>

                <BlockStack gap="200">
                  <Text as="h3" variant="heading" fontWeight="bold">
                    3. Set Up Discounts & Tags

                  </Text>
                  <Text as="p" variant="bodyMd" color="subdued">
                    Create custom discounts and automatic tagging rules for different order types.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Features Section */}
        {/* Features Section */}
<Layout.Section>
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      maxWidth: "1200px",
      margin: "0 auto",
    }}
  >
    <div
      style={{
        display: "flex",
        gap: "15px",
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      {/* Draft Orders Card */}
      <div
        style={{
          flex: "1",
          minWidth: "300px",
          backgroundColor: "white",
          borderRadius: "16px",
          padding: "28px 24px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <DraftOrderIcon width={64} height={64} />
        </div>
        <h3
          style={{
            fontSize: "18px",
            fontWeight: 600,
            marginBottom: "10px",
            color: "#202223",
          }}
        >
          Draft Orders
        </h3>
        <p
          style={{
            fontSize: "14px",
            color: "#5c5f62",
            lineHeight: "1.6",
          }}
        >
          Customers can easily create draft orders that are automatically saved
          to your Shopify admin with all details.
        </p>
      </div>

    {/* Metrics Card */}
<div
  style={{
    flex: "1",
    minWidth: "300px",
    backgroundColor: "#f5f8faff", // Darker, more professional blue
    borderRadius: "16px",
    padding: "28px 24px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    textAlign: "center",
    color: "white", // Set default text color to white
    position: "relative",
    overflow: "hidden",
    opacity:"0.8"
  }}
>
  {/* Optional subtle gradient overlay */}
  <div style={{
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "100%",
    background: "linear-gradient(135deg, rgba(242, 245, 246, 0.1) 0%, rgba(1, 113, 161, 0) 100%)",
    zIndex: 0,
  }}></div>
  
  <div style={{ position: "relative", zIndex: 1 }}>
    {/* Circular progress indicator (optional) */}
    <div style={{
      width: "120px",
      height: "120px",
      borderRadius: "50%",
      border: "8px solid rgba(39, 38, 38, 0.2)",
      margin: "0 auto 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{ 
        fontSize: "48px", 
        fontWeight: "700", 
        lineHeight: 1 ,
        color:"black"
      }}>
        {draftOrderCount}
      </div>
    </div>
    
    {/* Title */}
    <div style={{ 
      fontSize: "18px", 
      fontWeight: "600", 
      marginBottom: "8px",
      letterSpacing: "0.5px",
      color:"black"
    }}>
      CUSTOMER DRAFT ORDERS
    </div>
    
    {/* Status badge */}
    <div style={{ 
      display: "inline-block",
      backgroundColor: setting.doubleDraftOrdersEnabled ? "#27AE60" : "#E74C3C",
      color: "white",
      fontSize: "14px",
      fontWeight: "600",
      padding: "6px 16px",
      borderRadius: "20px",
      marginTop: "12px"
    }}>
      {setting.doubleDraftOrdersEnabled
        ? "Dual Order Mode Active"
        : "Single Order Mode Active"}
    </div>
  </div>
</div>
 

      {/* Integrations Card */}
      <div
        style={{
          flex: "1",
          minWidth: "300px",
          backgroundColor: "white",
          borderRadius: "16px",
          padding: "28px 24px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <IntegrationIcon width={64} height={64} />
        </div>
        <h3
          style={{
            fontSize: "18px",
            fontWeight: 600,
            marginBottom: "10px",
            color: "#202223",
          }}
        >
          Advanced Order Rules
        </h3>
        <p
          style={{
            fontSize: "14px",
            color: "#5c5f62",
            lineHeight: "1.6",
          }}
        >
          Configure different payment rules, discounts, and tags for single or
          double draft orders.
        </p>
      </div>
    </div>
  </div>
</Layout.Section>


       
        </Layout>
      </div>
    </Page>
  );
}