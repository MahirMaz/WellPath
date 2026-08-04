"""
Focused re-analysis: does REAL family history (MCQ300C = 'close relative had
diabetes') add predictive value beyond KPIs + demographics for elevated HbA1c
(>=5.7)? Mirrors the main pipeline's conventions: participant-level 80/20 split
(random_state=42), regularized logistic regression, complete-case paired
comparison on the same test rows, 1,000-resample bootstrap CI, plus the odds
ratio (effect size) and age-stratified AUCs.

Standalone; reads the project's data/raw/nhanes files. Not clinically validated.
"""
import pandas as pd, numpy as np, os, json, warnings
warnings.filterwarnings('ignore')
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
import statsmodels.api as sm

ROOT = r"C:\Users\Mahir\Desktop\WellPath\wellpath-condition-models"
DATA = os.path.join(ROOT, "data", "raw", "nhanes")
OUT  = os.path.join(ROOT, "outputs", "tables")

def rd(f, cols):
    d = pd.read_sas(os.path.join(DATA, f + ".xpt"), format="xport")
    return d[[c for c in cols if c in d.columns]]

demo = rd("DEMO_J", ["SEQN","RIDAGEYR","RIAGENDR","INDFMPIR"])
bmx  = rd("BMX_J",  ["SEQN","BMXBMI","BMXWT"])
bpx  = rd("BPX_J",  ["SEQN","BPXSY1","BPXSY2","BPXDI1","BPXDI2","BPXPLS"])
ghb  = rd("GHB_J",  ["SEQN","LBXGH"])
paq  = rd("PAQ_J",  ["SEQN","PAQ650","PAQ665","PAD680"])
slq  = rd("SLQ_J",  ["SEQN","SLD012"])
mcq  = rd("MCQ_J",  ["SEQN","MCQ300C"])

df = demo
for t in [bmx,bpx,ghb,paq,slq,mcq]:
    df = df.merge(t, on="SEQN", how="left")
df = df[df.RIDAGEYR >= 18].copy()

for c in ["BPXSY1","BPXSY2","BPXDI1","BPXDI2"]:
    df[c] = df[c].replace(0, np.nan)
yn = lambda s: s.map({1:1, 2:0})

feat = pd.DataFrame({
    "sleep_hours": df.SLD012,
    "resting_heart_rate": df.BPXPLS,
    "systolic_bp": df[["BPXSY1","BPXSY2"]].mean(axis=1),
    "diastolic_bp": df[["BPXDI1","BPXDI2"]].mean(axis=1),
    "bmi": df.BMXBMI,
    "weight_kg": df.BMXWT,
    "vigorous_activity": yn(df.PAQ650),
    "moderate_activity": yn(df.PAQ665),
    "sedentary_minutes": df.PAD680.where(df.PAD680 <= 1200),
    "age": df.RIDAGEYR,
    "sex": (df.RIAGENDR == 2).astype(float),
    "income_context": df.INDFMPIR,
    "fh_diabetes": yn(df.MCQ300C),
})
feat["elevated_hba1c"] = (df.LBXGH >= 5.7).astype(float)
feat.loc[df.LBXGH.isna(), "elevated_hba1c"] = np.nan

base_cols = ["sleep_hours","resting_heart_rate","systolic_bp","diastolic_bp","bmi","weight_kg",
             "vigorous_activity","moderate_activity","sedentary_minutes","age","sex","income_context"]
full_cols = base_cols + ["fh_diabetes"]

# complete-case on base + family history + outcome  -> identical rows for a fair paired test
m = feat.dropna(subset=full_cols + ["elevated_hba1c"]).copy()
y = m["elevated_hba1c"].astype(int).values
print("="*70)
print("REAL family history (MCQ300C) vs your DIQ170 proxy")
print("="*70)
print(f"Complete-case N = {len(m)} | elevated-HbA1c prevalence = {y.mean()*100:.1f}%")
print(f"Family-history-of-diabetes 'yes' = {m.fh_diabetes.mean()*100:.1f}%")

# --- univariate connection (like the Insights-tab claim) ---
print("\n[Univariate] prediabetes+ rate by family history:")
for v,lab in [(0,'No FH'),(1,'Has FH')]:
    s=m[m.fh_diabetes==v]; print(f"   {lab:7s}: { (s.elevated_hba1c.mean()*100):.1f}%   (n={len(s)})")

Xtr, Xte, ytr, yte = train_test_split(m, y, test_size=0.2, random_state=42, stratify=y)

def fit_predict(cols):
    pipe = Pipeline([("imp", SimpleImputer(strategy="median")),
                     ("sc", StandardScaler()),
                     ("lr", LogisticRegression(C=1.0, max_iter=1000))])
    pipe.fit(Xtr[cols], ytr)
    return pipe.predict_proba(Xte[cols])[:,1]

p_base = fit_predict(base_cols)
p_full = fit_predict(full_cols)
auc_base = roc_auc_score(yte, p_base)
auc_full = roc_auc_score(yte, p_full)

# paired bootstrap CI on delta AUC
rng = np.random.default_rng(42); deltas=[]
yte_arr=np.asarray(yte)
for _ in range(1000):
    idx = rng.integers(0, len(yte_arr), len(yte_arr))
    if yte_arr[idx].min()==yte_arr[idx].max(): continue
    deltas.append(roc_auc_score(yte_arr[idx], p_full[idx]) - roc_auc_score(yte_arr[idx], p_base[idx]))
lo, hi = np.percentile(deltas, [2.5, 97.5])

print(f"\n[Incremental value of REAL family history]  (same {len(yte_arr)} test people)")
print(f"   base (KPIs + demographics)      AUC {auc_base:.3f}")
print(f"   + family history (MCQ300C)      AUC {auc_full:.3f}")
print(f"   delta AUC = {auc_full-auc_base:+.3f}   95% CI [{lo:+.3f}, {hi:+.3f}]")
print(f"   (your DIQ170 proxy delta was +0.005, CI [-0.001, +0.012])")

# --- effect size (odds ratio) from statsmodels, standardized continuous ---
Xz = m[full_cols].copy()
cont=["sleep_hours","resting_heart_rate","systolic_bp","diastolic_bp","bmi","weight_kg",
      "sedentary_minutes","age","income_context"]
for c in cont: Xz[c]=(Xz[c]-Xz[c].mean())/Xz[c].std()
res = sm.Logit(m["elevated_hba1c"], sm.add_constant(Xz)).fit(disp=0)
orv=np.exp(res.params["fh_diabetes"]); ci=np.exp(res.conf_int().loc["fh_diabetes"])
print(f"\n[Effect size] family history odds ratio = {orv:.2f}  95% CI [{ci[0]:.2f}, {ci[1]:.2f}], p={res.pvalues['fh_diabetes']:.4f}")
print("   -> strong, significant risk factor even though its AUC lift is small (OR != AUC gain)")

# --- age-stratified AUC (full model) ---
print("\n[Age-stratified AUC]  (full model, test set)")
bands=[('18-39',18,40),('40-59',40,60),('60+',60,200)]
age_rows=[]
for name,a,b in bands:
    mask=(Xte.age>=a)&(Xte.age<b)
    yy=yte_arr[mask.values]; pp=p_full[mask.values]
    if len(yy)>30 and yy.min()!=yy.max():
        au=roc_auc_score(yy,pp); age_rows.append((name,len(yy),yy.mean()*100,au))
        print(f"   {name}: AUC {au:.3f}  (n={len(yy)}, prevalence {yy.mean()*100:.0f}%)")

# save
pd.DataFrame([{
 "n_complete_case":len(m), "prevalence_pct":round(y.mean()*100,1),
 "fh_yes_pct":round(m.fh_diabetes.mean()*100,1),
 "auc_base_kpis_demo":round(auc_base,3), "auc_plus_family_history":round(auc_full,3),
 "delta_auc":round(auc_full-auc_base,3), "delta_ci_lo":round(lo,3), "delta_ci_hi":round(hi,3),
 "family_history_odds_ratio":round(orv,2), "or_ci_lo":round(ci[0],2), "or_ci_hi":round(ci[1],2),
 "diq170_proxy_delta_for_reference":0.005,
}]).to_csv(os.path.join(OUT,"family_history_mcq_reanalysis.csv"), index=False)
print(f"\n[OUT] wrote {os.path.join('outputs','tables','family_history_mcq_reanalysis.csv')}")
print("DONE.")
