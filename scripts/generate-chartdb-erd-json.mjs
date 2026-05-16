import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const VIEWS_DIR = path.join(ROOT, "docs", "erd", "views");
const OUTPUT_DIR = path.join(ROOT, "docs", "erd", "chartdb");

// ChartDB's DBML importer strips TableGroup and top-level Note blocks.
// These generated backup files use ChartDB-native areas/notes so the canvas
// remains readable without manually drawing rectangles in the UI.
const AREA_META = {
  audit: { color: "#64748B", note: "Audit and lifecycle events." },
  billing: { color: "#059669", note: "Payments, insurance, contracts, and claims." },
  clinical: { color: "#E11D48", note: "Encounters, notes, documents, and care tasks." },
  control_plane: { color: "#0891B2", note: "SaaS metadata only; no PHI." },
  identity: { color: "#2563EB", note: "Login users, doctors, staff, and roles." },
  messaging: { color: "#DB2777", note: "Chat, notifications, receipts, and delivery." },
  patient_record: { color: "#0D9488", note: "Patient profile, consent, and history." },
  plans: { color: "#16A34A", note: "Plans, entitlements, and feature access." },
  provisioning: { color: "#F97316", note: "Tenant setup, migrations, and activation." },
  reference: { color: "#64748B", note: "Lookup data that standardizes forms." },
  registry: { color: "#4F46E5", note: "Tenant registry and routing metadata." },
  runtime: { color: "#7C3AED", note: "Branding, pages, consent, and feature config." },
  scheduling: { color: "#D97706", note: "Clinics, availability, slots, and bookings." },
  security: { color: "#E11D48", note: "Server-only secrets and secure references." },
};

const DEFAULT_AREA = { color: "#475569", note: "Supporting tables." };

const AREA_ORDER_BY_FILE = {
  "10-doctor-provider-detail.dbml": ["identity", "reference", "scheduling", "runtime", "billing"],
  "11-patient-record-detail.dbml": ["identity", "patient_record", "reference", "runtime", "billing"],
  "12-appointment-booking-detail.dbml": ["identity", "patient_record", "reference", "scheduling", "clinical", "billing", "messaging"],
  "13-clinical-actions-detail.dbml": ["identity", "patient_record", "scheduling", "reference", "clinical", "messaging", "billing"],
  "14-predoctor-precheck-process.dbml": ["identity", "patient_record", "scheduling", "clinical", "messaging"],
  "15-messaging-notification-process.dbml": ["identity", "patient_record", "messaging"],
  "16-billing-insurance-process.dbml": ["identity", "patient_record", "reference", "scheduling", "clinical", "billing"],
  "17-staff-lifecycle-process.dbml": ["identity", "scheduling", "audit"],
  "18-runtime-branding-consent-feature-process.dbml": ["control_plane", "identity", "patient_record", "runtime"],
  "19-saas-tenant-provisioning-process.dbml": ["registry", "security", "plans", "provisioning", "audit"],
};

const TABLE_ORDER_BY_FILE = {
  "10-doctor-provider-detail.dbml": [
    "identity.users",
    "identity.doctors",
    "identity.staff_members",
    "identity.predoctors",
    "identity.doctor_specialties",
    "reference.specialties",
    "scheduling.clinics",
    "scheduling.doctor_schedule_templates",
    "scheduling.secretary_slots",
    "runtime.tenant_profile",
    "runtime.tenant_app_config",
    "billing.insurance_providers",
    "billing.doctor_insurance_contracts",
  ],
  "11-patient-record-detail.dbml": [
    "identity.users",
    "identity.doctors",
    "patient_record.patients",
    "patient_record.patient_consents",
    "patient_record.patient_devices",
    "patient_record.patient_family_history",
    "patient_record.patient_allergies",
    "patient_record.patient_medications",
    "patient_record.patient_surgeries",
    "patient_record.patient_vaccinations",
    "reference.cities",
    "reference.countries",
    "reference.insurance_providers",
    "runtime.tenant_profile",
    "runtime.tenant_app_config",
    "billing.patient_insurance_policies",
  ],
  "12-appointment-booking-detail.dbml": [
    "identity.users",
    "identity.doctors",
    "patient_record.patients",
    "reference.visit_types",
    "scheduling.clinics",
    "scheduling.doctor_schedule_templates",
    "scheduling.secretary_slots",
    "scheduling.appointments",
    "clinical.encounters",
    "clinical.care_tasks",
    "billing.payments",
    "messaging.notification_events",
    "messaging.notification_deliveries",
    "patient_record.patient_devices",
  ],
};

function idFrom(value) {
  return value
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function schemaOf(tableName) {
  return tableName.includes(".") ? tableName.split(".")[0] : "public";
}

function tableShortName(tableName) {
  return tableName.includes(".") ? tableName.split(".").slice(1).join(".") : tableName;
}

function areaMeta(schema) {
  return AREA_META[schema] ?? DEFAULT_AREA;
}

function parseDbml(dbml) {
  const projectName = dbml.match(/Project\s+"([^"]+)"/)?.[1] ?? "DoctoLeb ERD";
  const projectNote = dbml.match(/Project\s+"[^"]+"\s*\{[\s\S]*?Note:\s+"([^"]+)"/)?.[1] ?? "";
  const relationshipStory =
    dbml.match(/Note\s+relationship_story\s*\{\s*'([^']*)'\s*\}/)?.[1] ??
    dbml.match(/Note\s+relationship_story\s*\{\s*"([^"]*)"\s*\}/)?.[1] ??
    "";

  const tables = [];
  const tableMap = new Map();

  for (const match of dbml.matchAll(/Table\s+([A-Za-z_][\w.]*?)\s*\{([\s\S]*?)\n\}/g)) {
    const [, name, body] = match;
    const note =
      body.match(/^\s*Note:\s*'([^']*)'/m)?.[1] ??
      body.match(/^\s*Note:\s*"([^"]*)"/m)?.[1] ??
      "";

    const columns = body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("Note:"))
      .filter((line) => !line.startsWith("//"))
      .map((line) => {
        const [rawName, rawType = "text"] = line.split(/\s+/);
        const type = rawType.replace(/\[\]$/, "");
        const lengthMatch = type.match(/\(([^)]+)\)/);
        const baseType = type.replace(/\(.*\)/, "").toLowerCase();
        return {
          name: rawName.replace(/"/g, ""),
          type,
          baseType,
          primaryKey: /\[[^\]]*\bpk\b[^\]]*\]/.test(line),
          unique: /\[[^\]]*\bunique\b[^\]]*\]/.test(line),
          nullable: !/\[[^\]]*not null[^\]]*\]/.test(line) && !/\[[^\]]*\bpk\b[^\]]*\]/.test(line),
          characterMaximumLength:
            /^(var)?char(acter varying)?$/i.test(baseType) && lengthMatch ? lengthMatch[1] : null,
          precision: lengthMatch && /^(numeric|decimal)$/i.test(baseType)
            ? Number.parseInt(lengthMatch[1].split(",")[0]?.trim(), 10)
            : null,
          scale: lengthMatch && /^(numeric|decimal)$/i.test(baseType)
            ? Number.parseInt(lengthMatch[1].split(",")[1]?.trim() ?? "", 10) || null
            : null,
        };
      });

    const table = { name, schema: schemaOf(name), shortName: tableShortName(name), note, columns };
    tables.push(table);
    tableMap.set(name, table);
  }

  const refs = [];
  const endpoint = "([A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)?)\\.([A-Za-z_]\\w*)";
  const refRegex = new RegExp(`Ref:\\s+${endpoint}\\s*>\\s*${endpoint}(?:\\s*\\[[^\\]]*\\])?`, "g");
  for (const match of dbml.matchAll(refRegex)) {
    refs.push({
      fromTable: match[1],
      fromColumn: match[2],
      toTable: match[3],
      toColumn: match[4],
    });
  }

  return { projectName, projectNote, relationshipStory, tables, tableMap, refs };
}

function orderedAreas(model, fileName) {
  const present = [...new Set(model.tables.map((table) => table.schema))];
  const preferred = AREA_ORDER_BY_FILE[fileName] ?? [];
  return [
    ...preferred.filter((schema) => present.includes(schema)),
    ...present.filter((schema) => !preferred.includes(schema)).sort(),
  ];
}

function orderedTablesForArea(model, fileName, schema) {
  const preferred = TABLE_ORDER_BY_FILE[fileName] ?? [];
  const rank = new Map(preferred.map((table, index) => [table, index]));
  return model.tables
    .filter((table) => table.schema === schema)
    .sort((left, right) => {
      const leftRank = rank.get(left.name) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = rank.get(right.name) ?? Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return model.tables.indexOf(left) - model.tables.indexOf(right);
    });
}

function normalizeDbml(dbml, model, fileName) {
  const groups = orderedAreas(model, fileName)
    .map((schema) => {
      const meta = areaMeta(schema);
      const tables = orderedTablesForArea(model, fileName, schema).map((table) => `  ${table.name}`);
      if (tables.length === 0) return "";
      return [
        `TableGroup "${schema}" [color: ${meta.color}] {`,
        ...tables,
        "",
        `  Note: '${meta.note}'`,
        "}",
      ].join("\n");
    })
    .filter(Boolean);

  const refs = model.refs.map((ref) => {
    const color = areaMeta(schemaOf(ref.fromTable)).color;
    return `Ref: ${ref.fromTable}.${ref.fromColumn} > ${ref.toTable}.${ref.toColumn} [color: ${color}]`;
  });

  const story = model.relationshipStory || `Relation: ${model.projectNote || model.projectName}`;
  const cleaned = dbml
    .replace(/\n?TableGroup\s+"[^"]+"\s*(?:\[[^\]]*\])?\s*\{[\s\S]*?\n\}\s*/g, "\n")
    .replace(/\n?Note\s+relationship_story\s*\{[\s\S]*?\n\}\s*/g, "\n")
    .replace(/\n?Note\s+relationship_legend\s*\{[\s\S]*?\n\}\s*/g, "\n")
    .replace(/^Ref:\s+.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();

  return [
    cleaned,
    "",
    ...groups,
    "",
    "Note relationship_story {",
    `  '${story.replace(/'/g, "\\'")}'`,
    "}",
    "",
    "Note relationship_legend {",
    "  'Ref format: left foreign key > right owner. Line color follows the left table area.'",
    "}",
    "",
    ...refs,
    "",
  ].join("\n");
}

function tableHeight(table) {
  const visibleFields = Math.min(table.columns.length, 10);
  const footer = table.columns.length > 10 ? 32 : 0;
  return 42 + visibleFields * 32 + footer;
}

function buildChartDbDiagram(model, fileName) {
  const now = Date.now();
  const baseName = fileName.replace(/\.dbml$/, "");
  const areas = [];
  const tables = [];
  const relationships = [];
  const tableIds = new Map();
  const fieldIds = new Map();

  const areaOrder = orderedAreas(model, fileName);
  const areaWidth = 340;
  const xGap = 86;
  const yStart = 190;
  const tableWidth = 260;
  const innerPad = 34;
  const tableGap = 28;

  for (const [areaIndex, schema] of areaOrder.entries()) {
    const meta = areaMeta(schema);
    const areaTables = orderedTablesForArea(model, fileName, schema);
    const heights = areaTables.map(tableHeight);
    const contentHeight = heights.reduce((sum, height) => sum + height, 0) + Math.max(0, areaTables.length - 1) * tableGap;
    const areaX = 40 + areaIndex * (areaWidth + xGap);
    const areaY = yStart;
    const areaHeight = Math.max(360, contentHeight + 130);
    const areaId = `area_${idFrom(baseName)}_${idFrom(schema)}`;

    areas.push({
      id: areaId,
      name: schema,
      x: areaX,
      y: areaY,
      width: areaWidth,
      height: areaHeight,
      color: meta.color,
      order: areaIndex,
    });

    let tableY = areaY + 72;
    for (const [tableIndex, table] of areaTables.entries()) {
      const tableId = `table_${idFrom(baseName)}_${idFrom(table.name)}`;
      tableIds.set(table.name, tableId);

      const fields = table.columns.map((column, columnIndex) => {
        const fieldId = `field_${idFrom(baseName)}_${idFrom(table.name)}_${idFrom(column.name)}`;
        fieldIds.set(`${table.name}.${column.name}`, fieldId);
        return {
          id: fieldId,
          name: column.name,
          type: { id: column.baseType || "text", name: column.baseType || "text" },
          primaryKey: column.primaryKey,
          unique: column.unique || column.primaryKey,
          nullable: column.nullable,
          createdAt: now,
          ...(column.characterMaximumLength ? { characterMaximumLength: column.characterMaximumLength } : {}),
          ...(Number.isFinite(column.precision) && column.precision ? { precision: column.precision } : {}),
          ...(Number.isFinite(column.scale) && column.scale ? { scale: column.scale } : {}),
        };
      });

      const pkFieldIds = fields.filter((field) => field.primaryKey).map((field) => field.id);
      const indexes = pkFieldIds.length
        ? [{
            id: `idx_${idFrom(baseName)}_${idFrom(table.name)}_pk`,
            name: "",
            unique: true,
            fieldIds: pkFieldIds,
            createdAt: now,
            isPrimaryKey: true,
          }]
        : [];

      tables.push({
        id: tableId,
        name: table.shortName,
        schema: table.schema,
        order: tables.length,
        fields,
        indexes,
        x: areaX + innerPad,
        y: tableY,
        width: tableWidth,
        color: meta.color,
        isView: false,
        createdAt: now,
        comments: table.note || null,
        expanded: false,
        parentAreaId: areaId,
      });

      tableY += heights[tableIndex] + tableGap;
    }
  }

  for (const [index, ref] of model.refs.entries()) {
    const sourceTableId = tableIds.get(ref.fromTable);
    const targetTableId = tableIds.get(ref.toTable);
    const sourceFieldId = fieldIds.get(`${ref.fromTable}.${ref.fromColumn}`);
    const targetFieldId = fieldIds.get(`${ref.toTable}.${ref.toColumn}`);
    if (!sourceTableId || !targetTableId || !sourceFieldId || !targetFieldId) continue;

    relationships.push({
      id: `rel_${idFrom(baseName)}_${index}`,
      name: `${tableShortName(ref.fromTable)}_${ref.fromColumn}_${tableShortName(ref.toTable)}_${ref.toColumn}`,
      sourceSchema: schemaOf(ref.fromTable),
      targetSchema: schemaOf(ref.toTable),
      sourceTableId,
      targetTableId,
      sourceFieldId,
      targetFieldId,
      sourceCardinality: "many",
      targetCardinality: "one",
      createdAt: now,
    });
  }

  const maxAreaBottom = areas.reduce((max, area) => Math.max(max, area.y + area.height), yStart);
  const notes = [
    {
      id: `note_${idFrom(baseName)}_legend`,
      content: "Read: FK > owner. Areas group schemas. Lines should flow left to right.",
      x: 40,
      y: 40,
      width: 520,
      height: 110,
      color: "#FEF3C7",
      order: 0,
    },
  ];
  if (model.relationshipStory) {
    notes.push({
      id: `note_${idFrom(baseName)}_story`,
      content: model.relationshipStory.replace(/^Relation:\s*/i, ""),
      x: 600,
      y: 40,
      width: 560,
      height: 110,
      color: "#DBEAFE",
      order: 1,
    });
  }

  return {
    id: `diagram_${idFrom(baseName)}`,
    name: model.projectName,
    databaseType: "postgresql",
    tables,
    relationships,
    dependencies: [],
    areas,
    customTypes: [],
    notes,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    viewport: { x: 0, y: 0, zoom: 0.65 },
    canvasBounds: {
      x: 0,
      y: 0,
      width: areas.length * (areaWidth + xGap) + 120,
      height: maxAreaBottom + 120,
    },
  };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const files = (await readdir(VIEWS_DIR))
    .filter((file) => file.endsWith(".dbml"))
    .sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const filePath = path.join(VIEWS_DIR, file);
    const dbml = await readFile(filePath, "utf8");
    const model = parseDbml(dbml);
    const normalized = normalizeDbml(dbml, model, file);
    if (normalized !== dbml) {
      await writeFile(filePath, normalized, "utf8");
    }

    const diagram = buildChartDbDiagram(parseDbml(normalized), file);
    const outputFile = file.replace(/\.dbml$/, ".chartdb.json");
    await writeFile(path.join(OUTPUT_DIR, outputFile), `${JSON.stringify(diagram, null, 2)}\n`, "utf8");
    console.log(`generated ${outputFile}`);
  }
}

await main();
