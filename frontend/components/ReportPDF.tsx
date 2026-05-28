import {
  Document, Page, View, Text, Image, StyleSheet,
} from "@react-pdf/renderer";

// ── Types (mirrors backend snapshot structure) ────────────────────────────────

interface PropertySnapshot {
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  purchase_price: number;
  down_payment: number;
  annual_interest_rate: number;
  mortgage_term: number;
  closing_costs: number;
  initial_repairs: number | null;
  pmi_monthly: number | null;
  rent_lower: number;
  rent_upper: number;
  property_tax_annual: number;
  hoa_annual: number | null;
  property_management_annual: number;
  vacancy_days_annual: number;
  maintenance_annual: number;
  insurance_annual: number;
  rent_increase_pct: number;
  maintenance_increase_pct: number;
  appreciation_rate_pct: number;
  property_tax_increase_pct: number;
  insurance_increase_pct: number;
}

interface YearRow {
  year: number;
  net_cash_flow: number;
  cumulative_cash_flow: number;
  property_value: number;
  equity: number;
  re_value: number;
  cumulative_roi_pct: number;
  stock_value: number;
}

interface ScenarioSummary {
  monthly_cash_flow_y1: number;
  annual_cash_flow_y1: number;
  coc_return: number;
  break_even_year: number | null;
}

interface AnalysisSnapshot {
  initial_investment: number;
  loan_amount: number;
  monthly_mortgage: number;
  market_label: string;
  summary_low: ScenarioSummary;
  summary_mid: ScenarioSummary;
  summary_high: ScenarioSummary;
  projections_low: YearRow[];
  projections_mid: YearRow[];
  projections_high: YearRow[];
}

export interface ReportSnapshot {
  property: PropertySnapshot;
  analysis: AnalysisSnapshot;
}

export interface ReportDocumentProps {
  snapshot: ReportSnapshot;
  chartImageUrl: string;
  reportId: string;
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toFixed(2)}%`;

const TYPE_LABELS: Record<string, string> = {
  single_family: "Single Family",
  multi_family: "Multi-Family",
  condo: "Condo",
  townhouse: "Townhouse",
};

// ── Styles ────────────────────────────────────────────────────────────────────

const C = {
  bg: "#18181b",
  surface: "#27272a",
  border: "#3f3f46",
  text: "#f4f4f5",
  muted: "#a1a1aa",
  green: "#10b981",
  red: "#f87171",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  amber: "#f59e0b",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, padding: 28, fontFamily: "Helvetica", fontSize: 8, color: C.text },
  pageLand: { backgroundColor: C.bg, padding: 28, fontFamily: "Helvetica", fontSize: 8, color: C.text, flexDirection: "column" },

  // Header
  header: { backgroundColor: C.surface, borderRadius: 6, padding: 12, marginBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.text },
  headerSub: { fontSize: 8, color: C.muted, marginTop: 2 },
  headerRight: { alignItems: "flex-end" },
  headerId: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.blue },
  headerDate: { fontSize: 7, color: C.muted, marginTop: 2 },

  // Section
  sectionTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5, marginTop: 12 },

  // Two-column grid
  row2: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },

  // Info card
  card: { backgroundColor: C.surface, borderRadius: 5, padding: 8, marginBottom: 4 },
  cardLabel: { fontSize: 7, color: C.muted, marginBottom: 2 },
  cardValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.text },

  // Input row
  inputRow: { flexDirection: "row", justifyContent: "space-between", borderBottomColor: C.border, borderBottomWidth: 0.5, paddingVertical: 2 },
  inputLabel: { color: C.muted, flex: 1 },
  inputValue: { fontFamily: "Helvetica-Bold", color: C.text },

  // Metric card (3-up)
  row3: { flexDirection: "row", gap: 8, marginBottom: 4 },
  metricCard: { flex: 1, backgroundColor: C.surface, borderRadius: 5, padding: 8 },
  metricLabel: { fontSize: 7, color: C.muted, marginBottom: 3 },
  metricValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.text },

  // Scenario table
  table: { backgroundColor: C.surface, borderRadius: 5, overflow: "hidden" },
  tableHead: { backgroundColor: "#3f3f46", flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6 },
  tableRow: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, borderBottomColor: C.border, borderBottomWidth: 0.5 },
  tableRowAlt: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, borderBottomColor: C.border, borderBottomWidth: 0.5, backgroundColor: "#232326" },
  thLabel: { flex: 2, fontSize: 7, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase" },
  thScenario: { flex: 1, fontSize: 7, fontFamily: "Helvetica-Bold", color: C.muted, textAlign: "right" },
  tdLabel: { flex: 2, fontSize: 8, color: C.text },
  tdVal: { flex: 1, fontSize: 8, textAlign: "right", fontFamily: "Helvetica-Bold" },

  // Projection table
  projHead: { backgroundColor: "#3f3f46", flexDirection: "row", paddingVertical: 3, paddingHorizontal: 4 },
  projRow: { flexDirection: "row", paddingVertical: 2, paddingHorizontal: 4, borderBottomColor: C.border, borderBottomWidth: 0.3 },
  projRowAlt: { flexDirection: "row", paddingVertical: 2, paddingHorizontal: 4, borderBottomColor: C.border, borderBottomWidth: 0.3, backgroundColor: "#232326" },
  projTh: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.muted, textAlign: "right", flex: 1 },
  projThYr: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.muted, flex: 0.5 },
  projTd: { fontSize: 7, textAlign: "right", flex: 1, color: C.text },
  projTdYr: { fontSize: 7, flex: 0.5, color: C.muted, fontFamily: "Helvetica-Bold" },

  // Chart page
  chartTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.text, marginBottom: 8 },
  chartImg: { width: "100%", borderRadius: 5 },
  chartNote: { fontSize: 7, color: C.muted, marginTop: 6, textAlign: "center" },

  // Scenario label
  scenarioLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.text, marginBottom: 6, marginTop: 14 },

  // Footer
  footer: { position: "absolute", bottom: 14, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 6.5, color: C.muted },
});

// ── Sub-components ────────────────────────────────────────────────────────────

function InputRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.inputRow}>
      <Text style={s.inputLabel}>{label}</Text>
      <Text style={s.inputValue}>{value}</Text>
    </View>
  );
}

function ScenarioTable({ analysis }: { analysis: AnalysisSnapshot }) {
  const rows: [string, (sm: ScenarioSummary) => string, (sm: ScenarioSummary) => boolean][] = [
    ["Monthly CF (Yr 1)", (sm) => usd(sm.monthly_cash_flow_y1), (sm) => sm.monthly_cash_flow_y1 < 0],
    ["Annual CF (Yr 1)", (sm) => usd(sm.annual_cash_flow_y1), (sm) => sm.annual_cash_flow_y1 < 0],
    ["CoC Return", (sm) => pct(sm.coc_return), (sm) => sm.coc_return < 0],
    ["Break-even", (sm) => sm.break_even_year ? `Year ${sm.break_even_year}` : "Never", (sm) => !sm.break_even_year],
  ];

  return (
    <View style={s.table}>
      <View style={s.tableHead}>
        <Text style={s.thLabel}>Metric</Text>
        <Text style={s.thScenario}>Low Rent</Text>
        <Text style={s.thScenario}>Mid Rent</Text>
        <Text style={s.thScenario}>High Rent</Text>
      </View>
      {rows.map(([label, fmt, isNeg], i) => (
        <View key={label} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
          <Text style={s.tdLabel}>{label}</Text>
          {([analysis.summary_low, analysis.summary_mid, analysis.summary_high] as ScenarioSummary[]).map((sm, j) => (
            <Text key={j} style={[s.tdVal, { color: isNeg(sm) ? C.red : C.green }]}>{fmt(sm)}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function ProjectionTable({ rows, scenarioLabel, marketLabel }: { rows: YearRow[]; scenarioLabel: string; marketLabel: string }) {
  return (
    <View>
      <Text style={s.scenarioLabel}>{scenarioLabel}</Text>
      <View style={[s.table, { marginBottom: 8 }]}>
        <View style={s.projHead}>
          <Text style={s.projThYr}>Yr</Text>
          <Text style={s.projTh}>Net CF</Text>
          <Text style={s.projTh}>Cum. CF</Text>
          <Text style={s.projTh}>Prop. Value</Text>
          <Text style={s.projTh}>Equity</Text>
          <Text style={s.projTh}>RE Value</Text>
          <Text style={s.projTh}>ROI %</Text>
          <Text style={s.projTh}>{marketLabel}</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.year} style={i % 2 === 0 ? s.projRow : s.projRowAlt}>
            <Text style={s.projTdYr}>{r.year}</Text>
            <Text style={[s.projTd, { color: r.net_cash_flow < 0 ? C.red : C.green }]}>{usd(r.net_cash_flow)}</Text>
            <Text style={[s.projTd, { color: r.cumulative_cash_flow < 0 ? C.red : C.green }]}>{usd(r.cumulative_cash_flow)}</Text>
            <Text style={s.projTd}>{usd(r.property_value)}</Text>
            <Text style={s.projTd}>{usd(r.equity)}</Text>
            <Text style={[s.projTd, { color: C.green }]}>{usd(r.re_value)}</Text>
            <Text style={[s.projTd, { color: r.cumulative_roi_pct < 0 ? C.red : C.amber }]}>{pct(r.cumulative_roi_pct)}</Text>
            <Text style={[s.projTd, { color: C.purple }]}>{usd(r.stock_value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Footer({ reportId, page, total }: { reportId: string; page: number; total: number }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>REI Analyzer · Report {reportId}</Text>
      <Text style={s.footerText}>Page {page} of {total}</Text>
    </View>
  );
}

// ── Document ──────────────────────────────────────────────────────────────────

export function ReportDocument({ snapshot, chartImageUrl, reportId, generatedAt }: ReportDocumentProps) {
  const { property: p, analysis: a } = snapshot;
  const address = `${p.address_street}, ${p.address_city}, ${p.address_state} ${p.address_zip}`;
  const TOTAL_PAGES = 5;

  return (
    <Document title={`REI Report ${reportId}`} author="REI Analyzer">

      {/* ── Page 1: Inputs + Scenario Summary ──────────────────────────── */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>REI Analyzer — Investment Report</Text>
            <Text style={s.headerSub}>{address}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerId}>Report ID: {reportId}</Text>
            <Text style={s.headerDate}>Generated: {generatedAt}</Text>
          </View>
        </View>

        {/* Property + Acquisition */}
        <Text style={s.sectionTitle}>Property Details</Text>
        <View style={s.row2}>
          <View style={s.col}>
            <InputRow label="Type" value={TYPE_LABELS[p.property_type] ?? p.property_type} />
            {p.bedrooms != null && <InputRow label="Bedrooms" value={String(p.bedrooms)} />}
            {p.bathrooms != null && <InputRow label="Bathrooms" value={String(p.bathrooms)} />}
            {p.square_feet != null && <InputRow label="Square Feet" value={p.square_feet.toLocaleString()} />}
            <InputRow label="Rent Range" value={`${usd(p.rent_lower)} – ${usd(p.rent_upper)} / mo`} />
            <InputRow label="Vacancy" value={`${p.vacancy_days_annual} days / yr`} />
          </View>
          <View style={s.col}>
            <InputRow label="Purchase Price" value={usd(p.purchase_price)} />
            <InputRow label="Down Payment" value={`${p.down_payment}%`} />
            <InputRow label="Interest Rate" value={`${p.annual_interest_rate}%`} />
            <InputRow label="Mortgage Term" value={`${p.mortgage_term} years`} />
            <InputRow label="Closing Costs" value={usd(p.closing_costs)} />
            {p.initial_repairs != null && <InputRow label="Initial Repairs" value={usd(p.initial_repairs)} />}
            {p.pmi_monthly != null && p.pmi_monthly > 0 && <InputRow label="PMI (monthly)" value={usd(p.pmi_monthly)} />}
          </View>
        </View>

        <Text style={s.sectionTitle}>Annual Expenses</Text>
        <View style={s.row2}>
          <View style={s.col}>
            <InputRow label="Property Tax" value={usd(p.property_tax_annual)} />
            {p.hoa_annual != null && p.hoa_annual > 0 && <InputRow label="HOA" value={usd(p.hoa_annual)} />}
            <InputRow label="Management" value={usd(p.property_management_annual)} />
          </View>
          <View style={s.col}>
            <InputRow label="Maintenance" value={usd(p.maintenance_annual)} />
            <InputRow label="Insurance" value={usd(p.insurance_annual)} />
          </View>
        </View>

        <Text style={s.sectionTitle}>Year-over-Year Growth Assumptions</Text>
        <View style={s.row2}>
          <View style={s.col}>
            <InputRow label="Rent Increase" value={`${p.rent_increase_pct}% / yr`} />
            <InputRow label="Appreciation" value={`${p.appreciation_rate_pct}% / yr`} />
            <InputRow label="Property Tax Increase" value={`${p.property_tax_increase_pct}% / yr`} />
          </View>
          <View style={s.col}>
            <InputRow label="Maintenance Increase" value={`${p.maintenance_increase_pct}% / yr`} />
            <InputRow label="Insurance Increase" value={`${p.insurance_increase_pct}% / yr`} />
          </View>
        </View>

        <Text style={s.sectionTitle}>Key Metrics</Text>
        <View style={s.row3}>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Initial Investment</Text>
            <Text style={s.metricValue}>{usd(a.initial_investment)}</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Loan Amount</Text>
            <Text style={s.metricValue}>{usd(a.loan_amount)}</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>Monthly Mortgage</Text>
            <Text style={s.metricValue}>{usd(a.monthly_mortgage)}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Scenario Comparison</Text>
        <ScenarioTable analysis={a} />

        <Footer reportId={reportId} page={1} total={TOTAL_PAGES} />
      </Page>

      {/* ── Page 2: Chart ──────────────────────────────────────────────── */}
      <Page size="A4" orientation="landscape" style={s.pageLand}>
        <View style={s.header}>
          <Text style={s.headerTitle}>30-Year Projection Chart</Text>
          <Text style={s.headerId}>{reportId}</Text>
        </View>
        <Image src={chartImageUrl} style={s.chartImg} />
        <Text style={s.chartNote}>
          Chart reflects the scenario active at time of download. Green = RE Value, Amber = Cumulative ROI %, Purple = {a.market_label}.
        </Text>
        <Footer reportId={reportId} page={2} total={TOTAL_PAGES} />
      </Page>

      {/* ── Page 3: Low scenario table ─────────────────────────────────── */}
      <Page size="A4" orientation="landscape" style={s.pageLand}>
        <View style={s.header}>
          <Text style={s.headerTitle}>30-Year Projection — All Scenarios</Text>
          <Text style={s.headerId}>{reportId}</Text>
        </View>
        <ProjectionTable rows={a.projections_low} scenarioLabel="Low Rent Scenario" marketLabel={a.market_label} />
        <Footer reportId={reportId} page={3} total={TOTAL_PAGES} />
      </Page>

      {/* ── Page 4: Mid scenario table ─────────────────────────────────── */}
      <Page size="A4" orientation="landscape" style={s.pageLand}>
        <View style={s.header}>
          <Text style={s.headerTitle}>30-Year Projection — Mid Scenario</Text>
          <Text style={s.headerId}>{reportId}</Text>
        </View>
        <ProjectionTable rows={a.projections_mid} scenarioLabel="Mid Rent Scenario" marketLabel={a.market_label} />
        <Footer reportId={reportId} page={4} total={TOTAL_PAGES} />
      </Page>

      {/* ── Page 5: High scenario table ────────────────────────────────── */}
      <Page size="A4" orientation="landscape" style={s.pageLand}>
        <View style={s.header}>
          <Text style={s.headerTitle}>30-Year Projection — High Scenario</Text>
          <Text style={s.headerId}>{reportId}</Text>
        </View>
        <ProjectionTable rows={a.projections_high} scenarioLabel="High Rent Scenario" marketLabel={a.market_label} />
        <Footer reportId={reportId} page={5} total={TOTAL_PAGES} />
      </Page>

    </Document>
  );
}
