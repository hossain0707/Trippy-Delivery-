"use client";
import { useState, type CSSProperties } from "react";

export type Dimensions = { length: string; width: string; height: string };
export type PackageForm = "box" | "envelope";

export function ParcelPreview({ dimensions, form, bn }: { dimensions: Dimensions; form: PackageForm; bn: boolean }) {
  const [angle, setAngle] = useState(0);
  const valid = Object.values(dimensions).every(value => Number(value) > 0 && Number(value) <= 150);
  const scale = 174 / Math.max(...Object.values(dimensions).map(Number), 1);
  const vars = {
    "--parcel-l": Number(dimensions.length) * scale + "px",
    "--parcel-w": Number(dimensions.width) * scale + "px",
    "--parcel-h": Number(dimensions.height) * scale + "px",
    "--parcel-angle": (angle + 30) + "deg",
  } as CSSProperties;
  const t = (en: string, bangla: string) => bn ? bangla : en;
  const format = new Intl.NumberFormat(bn ? "bn-BD" : "en-BD", { maximumFractionDigits: 2 });
  return <section className="panel parcel-preview">
    <div className="preview-heading"><div><h2>{t("Live 3D preview", "লাইভ ৩ডি প্রিভিউ")}</h2>
      <p>{t("Updates with your package and dimensions.", "পার্সেলের ধরন ও মাপের সঙ্গে বদলায়।")}</p></div>
      <div className="preview-controls">
        <button className="secondary" type="button" disabled={!valid} onClick={() => setAngle(a => a + 45)}>{t("Rotate", "ঘোরান")} ↻</button>
        <button className="secondary" type="button" disabled={!valid} onClick={() => setAngle(0)}>{t("Reset view", "দৃশ্য রিসেট করুন")}</button>
      </div></div>
    <div className="parcel-stage">
      {valid ? <div className={"parcel-model " + form} style={vars} role="img"
        aria-label={(form === "box" ? t("Branded TRIPPY box", "ট্রিপি বাক্স") : t("Branded TRIPPY envelope", "ট্রিপি খাম")) + " · " + Object.values(dimensions).map(v => format.format(Number(v))).join(" × ") + " " + t("cm", "সেমি")}>
        {["front", "back", "left", "right", "top", "bottom"].map(face => <div key={face} className={"parcel-face " + face} aria-hidden="true">
          <span className="parcel-print"><span className="parcel-cube" aria-hidden="true"><i/><i/><i/></span><span><b>TRIPPY</b> Delivery</span></span>
        </div>)}
      </div> : <p>{t("Enter valid dimensions to see the package.", "পার্সেল দেখতে সঠিক মাপ লিখুন।")}</p>}
    </div>
    {valid && <dl className="parcel-dimensions">
      {([["length", t("Length", "দৈর্ঘ্য")], ["width", t("Width", "প্রস্থ")], ["height", t("Height", "উচ্চতা")]] as const).map(([key, label]) =>
        <div key={key}><dt>{label}</dt><dd>{format.format(Number(dimensions[key]))} {t("cm", "সেমি")}</dd></div>)}
    </dl>}
  </section>;
}
