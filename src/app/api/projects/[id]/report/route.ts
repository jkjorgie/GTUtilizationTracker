import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      projectManager: { select: { name: true } },
    },
  });

  if (!project) {
    return new NextResponse("Project not found", { status: 404 });
  }

  const htmlPath = path.join(
    process.cwd(),
    "demo-data",
    "Weekly Client Report 3 blank.html"
  );
  let html = await fs.readFile(htmlPath, "utf-8");

  const projectName = project.projectName;
  const clientName = project.client;
  const pmName = project.projectManager?.name ?? "Your Name";
  const preparedBy = `${pmName} | PM`;

  // Update page title
  html = html.replace(
    "<title>Weekly Client Report</title>",
    `<title>Weekly Client Report – ${escapeHtml(projectName)}</title>`
  );

  // Replace header project name
  html = html.replace(
    'id="hdr-project">Project Name<',
    `id="hdr-project">${escapeHtml(projectName)}<`
  );

  // Replace header client + prepared-by line
  html = html.replace(
    'id="hdr-client">Client: Client Name &nbsp;·&nbsp; <span id="hdr-preparedby">Prepared by: Your Name | PM</span>',
    `id="hdr-client">Client: ${escapeHtml(clientName)} &nbsp;·&nbsp; <span id="hdr-preparedby">Prepared by: ${escapeHtml(preparedBy)}</span>`
  );

  // Inject project data into the DB object before DB.init() so that
  // the header-edit panel and subsequent reports inherit these values.
  html = html.replace(
    "  DB.init();",
    `  DB.reports[0].project    = ${JSON.stringify(projectName)};
  DB.reports[0].client     = ${JSON.stringify(clientName)};
  DB.reports[0].preparedBy = ${JSON.stringify(preparedBy)};
  DB.init();`
  );

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
