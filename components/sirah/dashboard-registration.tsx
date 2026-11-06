"use client";
import { useEffect, useState } from "react";
import { SIRAH_TITLE } from "@/lib/sirah/catalog";
export function SirahDashboardRegistration() {
  const [orders, setOrders] = useState<
    {
      id: string;
      reference: string;
      paymentState: string;
      enrolmentState: string;
    }[]
  >([]);
  useEffect(() => {
    void fetch("/api/sirah/orders")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setOrders(data.orders);
      })
      .catch(() => {});
  }, []);
  if (!orders.length) return null;
  return (
    <section className="ga-dashboard-card">
      <h2>{SIRAH_TITLE}</h2>
      {orders.map((order) => (
        <article key={order.id}>
          <p>Reference: {order.reference}</p>
          <p>
            Payment: {order.paymentState} · Enrolment: {order.enrolmentState}
          </p>
          <a href={`/seerah/register?order=${order.id}`}>
            Your registration, payment evidence and course invitation →
          </a>
        </article>
      ))}
    </section>
  );
}
