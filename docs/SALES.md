# Running a Sale

**Status:** Implemented (fully Stripe-driven)
**Related:** [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md), [TIER_STRATEGY.md](./TIER_STRATEGY.md)

Sales are 100% Stripe-driven. You create a **Coupon** in Stripe; the app detects
it, applies it automatically at checkout (**the customer never types a code**),
and shows a diagonal **Sale** ribbon with the original price struck through, the
percent off, and a "for a limited time" note. No deploy or code change is needed
to start, change, or end a sale.

---

## How it works (so you know what the app reacts to)

- A sale = a Stripe **Coupon** restricted to a tier's **Product**
  (`applies_to.products`), with an optional **`redeem_by`** (the "limited time"
  end).
- `GET /v1/billing/tiers` lists your active coupons and, for each tier, finds one
  restricted to that tier's product. If found, it returns the discounted price,
  the percent off, and the end date.
- `POST /v1/billing/checkout` re-checks server-side and applies the coupon via
  `discounts` on the Checkout Session — so the customer sees the discount already
  applied, with nothing to enter.
- The subscribe page renders the ribbon, the struck-through original price,
  "N% off", and "for a limited time, through &lt;date&gt;".

---

## To START a sale — in the Stripe dashboard

1. **Product catalog → Coupons → Create coupon** (make sure you're in the right
   mode — Test vs Live — matching the keys the site uses).
2. **Discount:** *Percent off* (e.g. `30`). Amount off also works; the app just
   derives the percentage from it.
3. **Duration** — how long the discount lasts *once someone subscribes* (this is
   NOT the sale window):
   - **Forever** — the discounted price sticks as long as they stay subscribed
     (a locked-in sale price). Best match for what the page shows.
   - **Repeating (N months)** — discounted for N months, then full price.
   - **Once** — first invoice only.
4. **Apply to specific products** — select the tier's **Product**:
   - **Sleuth** → the Sleuth product
   - **Master Detective** → the Master Detective product
   - Select **both** products on one coupon to run the same sale across both, or
     make **one coupon per tier** if you want different percentages.
   - **Do not** apply a coupon to the **Genius** product (its price is hidden
     until earned).
5. **Redemption limits → Redeem by** — set the date/time the sale ends. This is
   the "for a limited time … through &lt;date&gt;" shown to customers, and after
   it passes the sale disappears automatically. Leave it unset for an open-ended
   sale (no end date is shown).
6. **Save.** The sale shows up on `/subscribe` within moments — no deploy.

That's the entire operation: create the coupon, restrict it to the product(s),
set an expiry. The app does the rest.

---

## To END a sale

Any one of these:

- Let the **Redeem by** date pass — it ends on its own, **or**
- **Delete** the coupon in Stripe, **or**
- Remove the product restriction.

The app stops showing the ribbon and stops auto-applying the discount.

---

## Notes & gotchas

- **No codes.** The coupon is auto-applied. While a sale is active on a tier,
  the manual "promotion code" box is turned off for that tier's checkout —
  Stripe forbids an auto-discount and manual promo codes on the same session.
- **New checkouts only.** A sale discounts *new* subscriptions. It does not
  retroactively discount someone already subscribed, and tier changes made in
  the Billing Portal price off the list price, not the sale.
- **Shown price = the recurring discounted amount.** If you set the coupon
  duration to **Once**, the customer only pays the sale price the first period,
  which won't match the "$X/month" shown. Use **Forever** or **Repeating** so the
  displayed price is what actually recurs.
- **Test vs Live.** Coupons live in the mode they're created in. Create the
  coupon in the same mode as the price/keys the site is using.
- **Tiers.** Only **Sleuth** and **Master Detective** show sales. Genius is
  excluded by design.
