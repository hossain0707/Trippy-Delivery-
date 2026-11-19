"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GoogleAccess, useCredential } from "@/features/account/GoogleAccess";
import { commerceApi } from "@/lib/commerce";
function CourierWork() {
  const token = useCredential();
  const [work, setWork] = useState<{
    application: { id: string; status: string } | null;
    orders: { id: string; status: string }[];
    parcels: { id: string; status: string; tracking_code: string }[];
  } | null>(null);
  const [status, setStatus] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState("bicycle");
  const load = useCallback(() =>
    commerceApi<NonNullable<typeof work>>("/commerce/courier/work", token).then(
      setWork,
    ), [token]);
  useEffect(() => {
    load().catch((e) => setStatus(e.message));
  }, [load]);
  return (
    <section className="panel">
      <h2>Partner application</h2>
      <p>
        Independent delivery partners use suitable, lawful transport. Approval
        requires an owner review of identity, required documents and service
        coverage. Documents are checked through a verified private process; do
        not upload identity documents here.
      </p>
      {work?.application ? (
        <p>Application: {work.application.status}</p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await commerceApi(
                "/commerce/courier/application",
                token,
                "POST",
                { phone, transport_mode: mode, service_cities: ["Dhaka"] },
              );
              await load();
              setStatus("Application submitted for review.");
            } catch (e) {
              setStatus((e as Error).message);
            }
          }}
        >
          <label>
            Contact number
            <input
              type="tel"
              required
              minLength={8}
              maxLength={20}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label>
            Transport
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {[
                "walk",
                "bicycle",
                "motorcycle",
                "car",
                "van",
                "bus",
                "other",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <button className="primary">Apply for Dhaka coverage</button>
        </form>
      )}
      <p role="status">{status}</p>
      <h2>Your delivery history</h2>
      {!work?.orders.length && !work?.parcels.length && (
        <p>No assignments yet.</p>
      )}
      {([...work?.orders.map(o=>({...o,entity:"grocery"}))||[],...work?.parcels.map(p=>({...p,entity:"parcel"}))||[]]).map(record=><form key={record.id} className="panel" onSubmit={async e=>{e.preventDefault();const d=new FormData(e.currentTarget);try{await commerceApi('/commerce/courier/update',token,'POST',{entity:record.entity,record_id:record.id,status:d.get('status'),note:d.get('note')});await load();setStatus('Delivery update recorded.');}catch(e){setStatus((e as Error).message);}}}><h3>{record.entity} {record.id}</h3><p>{record.status}</p><label>Delivery update<select name="status">{(record.entity==='grocery'?['out_for_delivery','delivered','failed']:['picked_up','in_transit','delivered','failed']).map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></label><label>Recipient acknowledgement or exception note<input name="note" required minLength={10} maxLength={500}/></label><button className="primary">Record update</button></form>)}

    </section>
  );
}
export function Courier() {
  return (
    <main className="wrap commerce-page">
      <nav className="market-nav">
        <Link className="wordmark" href="/">
          TRIPPY Delivery
        </Link>
        <Link href="/support">Partner support</Link>
      </nav>
      <h1>Deliver with TRIPPY.</h1>
      <GoogleAccess>
        <CourierWork />
      </GoogleAccess>
    </main>
  );
}
