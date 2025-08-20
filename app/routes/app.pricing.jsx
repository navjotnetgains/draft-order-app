// app/routes/pricing.jsx
import React from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  BlockStack,
  Icon,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { CheckIcon } from "@shopify/polaris-icons";
import { Link, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { billing } = await authenticate.admin(request);
  const billingData = await billing.check();

  let hasSubscription = false;
  let activePlanKey = null;

  if (billingData.appSubscriptions && billingData.appSubscriptions.length > 0) {
    const activeSub = billingData.appSubscriptions.find(
      (sub) => sub.status === "ACTIVE"
    );

    if (activeSub) {
      hasSubscription = true;

      const interval =
        activeSub.lineItems?.[0]?.plan?.pricingDetails?.interval || "";

      if (interval === "EVERY_30_DAYS") {
        activePlanKey = "monthly";
      } else if (interval === "EVERY_YEAR") {
        activePlanKey = "annual";
      } else {
        if (activeSub.name.toLowerCase().includes("monthly")) {
          activePlanKey = "monthly";
        } else if (activeSub.name.toLowerCase().includes("annual")) {
          activePlanKey = "annual";
        }
      }
    }
  }

  return { hasSubscription, activePlanKey };
}

export default function PricingPage() {
  const { activePlanKey } = useLoaderData();

  const plans = [
    {
      key: "free",
      name: "Free",
      price: "Free",
      description: "Perfect for trying out the app",
      features: [
        "Up to 10 draft orders/month",
        "Basic email notifications",
        "Standard support",
      ],
      buttonText: "Get Started",
      badge: { text: "Trial", status: "new" },
    },
    {
      key: "monthly",
      name: "Monthly subscription",
      price: "$10 / month",
      description: "Best for growing stores",
      features: [
        "Unlimited draft orders",
        "Advanced email customization",
        "Priority support",
      ],
      buttonText: "Subscribe Monthly",
      badge: { text: "Popular", status: "attention" },
      highlight: true,
    },
    {
      key: "annual",
      name: "Annual subscription",
      price: "$50 / year",
      description: "Save more with yearly billing",
      features: [
        "Everything in Monthly",
        "1-on-1 onboarding session",
        "Priority onboarding",
      ],
      buttonText: "Subscribe Yearly",
      badge: { text: "Best Value", status: "success" },
    },
  ];

  return (
    <Page title="Pricing Plans" fullWidth>
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <TitleBar title="Pricing" />

      <Layout>
        <Layout.Section>
          <Text as="p" variant="bodyMd" tone="subdued">
            Choose the plan that fits your store. You will be taken to Shopify
            to confirm billing.
          </Text>
        </Layout.Section>

        <Layout.Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "32px",
            }}
          >
          {plans.map((plan) => {
  const isActive = plan.key === activePlanKey;

  return (
    <div
      key={plan.key}
      style={{
        borderRadius: "16px",
        boxShadow: isActive
          ? "0 8px 24px rgba(0,0,0,0.15)"
          : "0 4px 12px rgba(0,0,0,0.08)",
        border: isActive ? "2px solid #008060" : "1px solid #e1e3e5",
        backgroundColor: isActive ? "#f0fdf4" : "#fff",
        padding: "4px", // small padding to separate Card from wrapper border
        transition: "all 0.3s ease",
      }}
    >
      <Card sectioned>
        <BlockStack gap="400" align="center">
          <BlockStack align="center" gap="200">
            <Text variant="headingLg" fontWeight="bold">
              {plan.name}
            </Text>
            {plan.badge && (
  <div style={{ display: "inline-flex" }}>
    <Badge size="small" status={plan.badge.status}>
      {plan.badge.text}
    </Badge>
  </div>
)}

          </BlockStack>

          <Text variant="headingXl" fontWeight="bold">
            {plan.price}
          </Text>

          <Text tone="subdued" alignment="center">
            {plan.description}
          </Text>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "start",
              textAlign: "left",
              gap: "12px",
              width: "100%",
              marginTop: "12px",
            }}
          >
            {plan.features.map((f, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  paddingBottom: "8px",
                  borderBottom:
                    i !== plan.features.length - 1
                      ? "1px solid #ececec"
                      : "none",
                }}
              >
                <Icon source={CheckIcon} tone="success" />
                <Text as="span" variant="bodyMd">
                  {f}
                </Text>
              </div>
            ))}
          </div>

          <Link
            to={isActive ? "#" : `/app/billing?plan=${plan.key}`}
            style={{
              display: "block",
              textAlign: "center",
              backgroundColor: isActive ? "#d1d5db" : "#111827",
              color:isActive ?"#111827": "#fff",
              fontWeight: "600",
              marginTop: "20px",
              borderRadius: "10px",
              padding: "14px",
              textDecoration: "none",
              pointerEvents: isActive ? "none" : "auto",
              opacity: isActive ? 0.7 : 1,
              transition: "background 0.3s ease",
            }}
            onMouseOver={(e) => {
              if (!isActive) e.currentTarget.style.background = "#374151";
            }}
            onMouseOut={(e) => {
              if (!isActive) e.currentTarget.style.background = "#111827";
            }}
          >
            {isActive ? "Currently Active" : plan.buttonText}
          </Link>
        </BlockStack>
      </Card>
    </div>
  );
})}

          </div>
        </Layout.Section>
      </Layout>
      </div>
    </Page>
  );
}
