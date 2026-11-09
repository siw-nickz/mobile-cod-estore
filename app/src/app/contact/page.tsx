import { api } from "@/lib/api";

export default async function ContactPage() {
  let contact = {
    contact_address: "",
    contact_phone: "",
    whatsapp_url: "https://wa.me/",
    map_embed_url: "",
  };
  try {
    contact = await api.contact();
  } catch {
    /* offline */
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Contact</h1>
      <div className="space-y-2 rounded-2xl border border-teal-900/10 bg-white p-4 text-sm">
        <p>
          <span className="font-medium">Address:</span> {contact.contact_address || "—"}
        </p>
        <p>
          <span className="font-medium">Phone:</span> {contact.contact_phone || "—"}
        </p>
        <a className="inline-block rounded-full bg-brand px-4 py-2 font-semibold text-white" href={contact.whatsapp_url}>
          WhatsApp
        </a>
      </div>
      {contact.map_embed_url ? (
        <iframe title="map" src={contact.map_embed_url} className="h-56 w-full rounded-2xl border-0" />
      ) : null}
    </div>
  );
}
