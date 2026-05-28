import {
  Document, Page, View, Text, Image, StyleSheet,
} from "@react-pdf/renderer";

// ── Types (mirrors backend snapshot structure) ────────────────────────────────

interface PropertySnapshot {
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  mls_id: string | null;
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
  market_cagr_pct: number;
}

interface YearRow {
  year: number;
  gross_rent: number;
  effective_rent: number;
  mortgage_payment: number;
  property_tax: number;
  hoa: number;
  management: number;
  maintenance: number;
  insurance: number;
  pmi: number;
  total_expenses: number;
  net_cash_flow: number;
  cumulative_cash_flow: number;
  property_value: number;
  loan_balance: number;
  equity: number;
  equity_gain: number;
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
  market_cagr_pct: number;
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
  bg: "#ffffff",
  surface: "#f4f4f5",
  border: "#d4d4d8",
  text: "#18181b",
  muted: "#52525b",
  green: "#059669",
  red: "#dc2626",
  blue: "#2563eb",
  purple: "#7c3aed",
  amber: "#b45309",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: { backgroundColor: C.bg, padding: 28, fontFamily: "Helvetica", fontSize: 8, color: C.text },
  pageLand: { backgroundColor: C.bg, padding: 28, fontFamily: "Helvetica", fontSize: 8, color: C.text, flexDirection: "column" },

  // Header
  header: { backgroundColor: C.surface, borderRadius: 6, borderWidth: 0.5, borderColor: C.border, padding: 12, marginBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
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
  metricCard: { flex: 1, backgroundColor: C.surface, borderRadius: 5, borderWidth: 0.5, borderColor: C.border, padding: 8 },
  metricLabel: { fontSize: 7, color: C.muted, marginBottom: 3 },
  metricValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.text },

  // Scenario table
  table: { backgroundColor: C.bg, borderRadius: 5, overflow: "hidden", borderWidth: 0.5, borderColor: C.border },
  tableHead: { backgroundColor: C.surface, flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6 },
  tableRow: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, borderBottomColor: C.border, borderBottomWidth: 0.5 },
  tableRowAlt: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, borderBottomColor: C.border, borderBottomWidth: 0.5, backgroundColor: "#f9fafb" },
  thLabel: { flex: 2, fontSize: 7, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase" },
  thScenario: { flex: 1, fontSize: 7, fontFamily: "Helvetica-Bold", color: C.muted, textAlign: "right" },
  tdLabel: { flex: 2, fontSize: 8, color: C.text },
  tdVal: { flex: 1, fontSize: 8, textAlign: "right", fontFamily: "Helvetica-Bold" },

  // Projection table (compact 20-column layout)
  projHead: { backgroundColor: C.surface, flexDirection: "row", paddingVertical: 3, paddingHorizontal: 3 },
  projRow: { flexDirection: "row", paddingVertical: 1.5, paddingHorizontal: 3, borderBottomColor: C.border, borderBottomWidth: 0.3 },
  projRowAlt: { flexDirection: "row", paddingVertical: 1.5, paddingHorizontal: 3, borderBottomColor: C.border, borderBottomWidth: 0.3, backgroundColor: "#f9fafb" },
  projTh: { fontSize: 6, fontFamily: "Helvetica-Bold", color: C.muted, textAlign: "right" },
  projThYr: { fontSize: 6, fontFamily: "Helvetica-Bold", color: C.muted },
  projTd: { fontSize: 6, textAlign: "right", color: C.text },
  projTdYr: { fontSize: 6, color: C.muted, fontFamily: "Helvetica-Bold" },

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

type ColDef = {
  header: string;
  flex: number;
  render: (r: YearRow) => string;
  color?: (r: YearRow) => string;
  left?: boolean;
};

function projCols(marketCagrPct: number): ColDef[] {
  return [
    { header: "Yr",         flex: 0.32, render: r => String(r.year),               color: _ => C.muted, left: true },
    { header: "Gross Rent", flex: 0.72, render: r => usd(r.gross_rent) },
    { header: "Eff. Rent",  flex: 0.72, render: r => usd(r.effective_rent) },
    { header: "Mortg.",     flex: 0.72, render: r => usd(r.mortgage_payment) },
    { header: "Taxes",      flex: 0.63, render: r => usd(r.property_tax) },
    { header: "HOA",        flex: 0.54, render: r => usd(r.hoa) },
    { header: "Mgmt",       flex: 0.54, render: r => usd(r.management) },
    { header: "Maint.",     flex: 0.63, render: r => usd(r.maintenance) },
    { header: "Insur.",     flex: 0.63, render: r => usd(r.insurance) },
    { header: "PMI",        flex: 0.54, render: r => usd(r.pmi) },
    { header: "Tot. Exp.",  flex: 0.72, render: r => usd(r.total_expenses) },
    { header: "Net CF",     flex: 0.72, render: r => usd(r.net_cash_flow),          color: r => r.net_cash_flow < 0 ? C.red : C.green },
    { header: "Cum. CF",    flex: 0.72, render: r => usd(r.cumulative_cash_flow),   color: r => r.cumulative_cash_flow < 0 ? C.red : C.green },
    { header: "Prop. Val",  flex: 0.76, render: r => usd(r.property_value) },
    { header: "Loan Bal.",  flex: 0.72, render: r => usd(r.loan_balance) },
    { header: "Equity",     flex: 0.67, render: r => usd(r.equity) },
    { header: "Eq. Gain",   flex: 0.72, render: r => usd(r.equity_gain),            color: _ => C.green },
    { header: "RE Value",   flex: 0.72, render: r => usd(r.re_value),               color: _ => C.green },
    { header: "ROI %",      flex: 0.58, render: r => pct(r.cumulative_roi_pct),     color: r => r.cumulative_roi_pct < 0 ? C.red : C.amber },
    { header: `Alt. Inv.\n(${marketCagrPct}%)`, flex: 0.72, render: r => usd(r.stock_value), color: _ => C.purple },
  ];
}

function ProjectionTable({ rows, scenarioLabel, marketCagrPct }: { rows: YearRow[]; scenarioLabel: string; marketCagrPct: number }) {
  const cols = projCols(marketCagrPct);
  return (
    <View>
      <Text style={s.scenarioLabel}>{scenarioLabel}</Text>
      <View style={[s.table, { marginBottom: 8 }]}>
        <View style={s.projHead}>
          {cols.map(col => (
            <Text key={col.header} style={[col.left ? s.projThYr : s.projTh, { flex: col.flex }]}>{col.header}</Text>
          ))}
        </View>
        {rows.map((r, i) => (
          <View key={r.year} style={i % 2 === 0 ? s.projRow : s.projRowAlt}>
            {cols.map(col => (
              <Text
                key={col.header}
                style={[col.left ? s.projTdYr : s.projTd, { flex: col.flex }, col.color ? { color: col.color(r) } : {}]}
              >
                {col.render(r)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function Footer({ reportId }: { reportId: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>REIA · Report {reportId}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

// ── Document ──────────────────────────────────────────────────────────────────

export function ReportDocument({ snapshot, chartImageUrl, reportId, generatedAt }: ReportDocumentProps) {
  const { property: p, analysis: a } = snapshot;
  const address = `${p.address_street}, ${p.address_city}, ${p.address_state} ${p.address_zip}`;
  return (
    <Document title={`REIA Report ${reportId}`} author="REIA">

      {/* ── Page 1: Inputs + Scenario Summary ──────────────────────────── */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Real Estate Investment Analysis - Report</Text>
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
            {p.mls_id != null && p.mls_id !== "" && <InputRow label="MLS ID" value={p.mls_id} />}
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
            <InputRow label="Alt. Investment CAGR" value={`${p.market_cagr_pct}% / yr`} />
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

        <Footer reportId={reportId} />
      </Page>

      {/* ── Page 2: Chart (omitted on re-downloads — chart is not in DOM so no image can be captured) ── */}
      {chartImageUrl !== "" && (
        <Page size="A4" orientation="landscape" style={s.pageLand}>
          <View style={s.header}>
            <Text style={s.headerTitle}>30-Year Projection Chart</Text>
            <Text style={s.headerId}>{reportId}</Text>
          </View>
          <Image src={chartImageUrl} style={s.chartImg} />
          <Text style={s.chartNote}>
            Chart reflects the scenario active at time of download. Green = RE Value, Amber = Cumulative ROI %, Purple = Alt. Investment ({a.market_cagr_pct}% CAGR).
          </Text>
          <Footer reportId={reportId} />
        </Page>
      )}

      {/* ── Page 3: Low scenario table ─────────────────────────────────── */}
      <Page size="A4" orientation="landscape" style={s.pageLand}>
        <View style={s.header}>
          <Text style={s.headerTitle}>30-Year Projection — Low Rent Scenario</Text>
          <Text style={s.headerId}>{reportId}</Text>
        </View>
        <ProjectionTable rows={a.projections_low} scenarioLabel="Low Rent Scenario" marketCagrPct={a.market_cagr_pct} />
        <Footer reportId={reportId} />
      </Page>

      {/* ── Page 4: Medium scenario table ──────────────────────────────── */}
      <Page size="A4" orientation="landscape" style={s.pageLand}>
        <View style={s.header}>
          <Text style={s.headerTitle}>30-Year Projection — Medium Rent Scenario</Text>
          <Text style={s.headerId}>{reportId}</Text>
        </View>
        <ProjectionTable rows={a.projections_mid} scenarioLabel="Medium Rent Scenario" marketCagrPct={a.market_cagr_pct} />
        <Footer reportId={reportId} />
      </Page>

      {/* ── Page 5: High scenario table ────────────────────────────────── */}
      <Page size="A4" orientation="landscape" style={s.pageLand}>
        <View style={s.header}>
          <Text style={s.headerTitle}>30-Year Projection — High Rent Scenario</Text>
          <Text style={s.headerId}>{reportId}</Text>
        </View>
        <ProjectionTable rows={a.projections_high} scenarioLabel="High Rent Scenario" marketCagrPct={a.market_cagr_pct} />
        <Footer reportId={reportId} />
      </Page>

    </Document>
  );
}
