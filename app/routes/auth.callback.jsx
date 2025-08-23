// app/routes/auth.callback.jsx
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { redirect } from "@remix-run/node";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  await db.session.upsert({
    where: { shop: session.shop },
    update: { accessToken: session.accessToken },
    create: {
      id: session.id,
      shop: session.shop,
      accessToken: session.accessToken,
      scope: session.scope,
      isOnline: session.isOnline,
    },
  });

  return redirect("/");
}
