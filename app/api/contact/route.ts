import { Resend } from "resend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; msg?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const msg = typeof body.msg === "string" ? body.msg.trim() : "";

  if (!name || !email || !msg || !EMAIL_RE.test(email)) {
    return Response.json({ ok: false, error: "Datos inválidos." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !to) {
    return Response.json(
      { ok: false, error: "Servicio de correo no configurado." },
      { status: 500 }
    );
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Arcade Vault <onboarding@resend.dev>",
      to,
      replyTo: email,
      subject: `[Arcade Vault] Nuevo mensaje de ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\n${msg}`,
    });

    if (error) {
      return Response.json({ ok: false, error: "No se pudo enviar el mensaje." }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "No se pudo enviar el mensaje." }, { status: 500 });
  }
}
