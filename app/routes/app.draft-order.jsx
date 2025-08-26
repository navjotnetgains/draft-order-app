(function () {
  function initDraftOrderApp() {
    const containers = document.querySelectorAll("draft-order-app");
    if (!containers.length) return;

    containers.forEach(container => {
      const scriptEl = container.querySelector("script[draft-order]");
      const targetEl = container.querySelector("[draft-order-block]");

      if (!scriptEl || !targetEl) return;

      let config = {};
      try {
        config = JSON.parse(scriptEl.innerHTML.trim() || "{}");
      } catch (e) {
        console.error("Invalid Draft Order config", e);
      }

      // Config
      const buttonText = config.button_text || "Create Draft Order";
      const bgColor = config.background_color || "#070707";
      const textColor = config.text_color || "#ffffff";
      const alignment = config.alignment || "flex-end";

      // Button
      targetEl.innerHTML = `
        <div style="display:flex; justify-content:${alignment};">
          <button id="create-draft-order"
            style="
              background:${bgColor};
              color:${textColor};
              padding:12px 24px;
              border:none;
              border-radius:8px;
              font-size:15px;
              cursor:pointer;
              width:100%;
              max-width:350px;
              white-space:nowrap;
            "
          >
            ${buttonText}
          </button>
        </div>
      `;

      // Modal & logic
      injectDraftOrderModal(bgColor, textColor);
    });
  }

  function injectDraftOrderModal(bgColor, textColor) {
    if (document.getElementById("modal-overlay")) return;

    const modalHtml = `
      <div id="modal-overlay" style="display:none;position:fixed;inset:0;width:100vw;height:100vh;z-index:99999;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);justify-content:center;align-items:center;">
        <div style="background:#fff;padding:24px;border-radius:12px;width:100%;max-width:700px;box-shadow:0 0 0 1px rgba(0,0,0,0.04),0 1px 3px rgba(0,0,0,0.2);position:relative;overflow-y:auto;max-height:95vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          
          <button id="close-modal" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:24px;cursor:pointer;">&times;</button>
          <h2 style="margin-bottom:20px;font-size:20px;">Shipping Address</h2>

          <form id="draft-order-form">
            <!-- Shipping Fields -->
            <input name="first_name" placeholder="First name" required style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #ccc;border-radius:6px;" />
            <input name="last_name" placeholder="Last name" required style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #ccc;border-radius:6px;" />
            <input name="address1" placeholder="Address" required style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #ccc;border-radius:6px;" />
            <input name="city" placeholder="City" required style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #ccc;border-radius:6px;" />
            <input name="zip" placeholder="ZIP code" required style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #ccc;border-radius:6px;" />
            
            <!-- Checkbox for billing -->
            <label style="display:flex;align-items:center;gap:8px;margin:12px 0;">
              <input type="checkbox" id="same-as-shipping" checked />
              Billing address same as shipping
            </label>

            <div id="billing-fields" style="display:none;">
              <h3 style="margin-top:20px;margin-bottom:12px;font-size:18px;">Billing Address</h3>
              <input name="billing_address1" placeholder="Billing Address" style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #ccc;border-radius:6px;" />
              <input name="billing_city" placeholder="Billing City" style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #ccc;border-radius:6px;" />
              <input name="billing_zip" placeholder="Billing ZIP" style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #ccc;border-radius:6px;" />
            </div>

            <button type="submit" style="background:${bgColor};color:${textColor};padding:12px;width:100%;border:none;border-radius:6px;font-size:16px;margin-top:12px;cursor:pointer;">
              Save as Draft Order
            </button>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const modal = document.getElementById("modal-overlay");
    const closeBtn = document.getElementById("close-modal");
    const form = document.getElementById("draft-order-form");
    const sameAsShipping = document.getElementById("same-as-shipping");
    const billingFields = document.getElementById("billing-fields");

    // Events
    document.getElementById("create-draft-order").addEventListener("click", () => {
      modal.style.display = "flex";
    });
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
    sameAsShipping.addEventListener("change", e => {
      billingFields.style.display = e.target.checked ? "none" : "block";
    });

    // Submit handler (hook into your API)
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      data.same_as_shipping = sameAsShipping.checked;

      try {
        const res = await fetch("/api/create-draft-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
          alert("Draft Order Created!");
          modal.style.display = "none";
        } else {
          alert("Error: " + (result.error || "Could not create draft order"));
        }
      } catch (err) {
        console.error("Draft order error:", err);
        alert("Network error");
      }
    });
  }

  // Run
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDraftOrderApp);
  } else {
    initDraftOrderApp();
  }
})();
