import nodemailer from "nodemailer";
import type { Order } from "./types";

export async function notifyNewOrder(order: Order) {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || user;
  const owner = process.env.OWNER_EMAIL || user;
  if (!host || !user || !pass || !owner) {
    console.log(`mail skipped: SMTP_* or OWNER_EMAIL empty (order ${order.order_number})`);
    return;
  }
  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });
    const lines = (order.items || [])
      .map((i) => `- ${i.product_sku} ${i.product_name} x${i.qty} @ ${i.unit_price}`)
      .join("\n");
    await transport.sendMail({
      from,
      to: owner,
      subject: `New COD order ${order.order_number}`,
      text: [
        `Order: ${order.order_number}`,
        `Customer: ${order.customer_name}`,
        `Phone: ${order.customer_phone}`,
        `Address: ${order.customer_address}`,
        `Note: ${order.note || "-"}`,
        "",
        lines || "(no lines)",
      ].join("\n"),
    });
  } catch (e) {
    console.error("mail send error (ignored):", e);
  }
}
