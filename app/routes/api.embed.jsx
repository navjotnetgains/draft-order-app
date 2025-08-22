// app/routes/embed.js
export async function loader() {
  return new Response(embedScript, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600"
    }
  });
}

const embedScript = `
(function() {
  if (window.__DraftOrderEmbedLoaded) return;
  window.__DraftOrderEmbedLoaded = true;

  /* -------------------- Helpers -------------------- */
  function showToast(message, duration = 4000) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = \`
        position: fixed; top:20px; left:50%; transform:translateX(-50%);
        z-index:1000000; display:flex; flex-direction:column; gap:10px;
        max-width:300px; width:100%; align-items:center; pointer-events:none;
      \`;
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.style.cssText = \`
      background:rgba(0,0,0,0.8); color:white; padding:12px 20px;
      border-radius:6px; font-size:14px; box-shadow:0 2px 6px rgba(0,0,0,0.3);
      opacity:0; transition:opacity 0.3s ease; pointer-events:auto;
    \`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
  }

  function fetchCart() {
    return fetch('/cart.js').then(res => res.json());
  }

  function getShopDomain() {
    if (window.Shopify && window.Shopify.shop) return window.Shopify.shop;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('shop')) return urlParams.get('shop');
    if (window.location.hostname.includes('.myshopify.com')) return window.location.hostname;
    return window.location.hostname;
  }

  /* -------------------- Modal + Button -------------------- */
  const modalHTML = \`
    <div id="modal-overlay" style="display:none;position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);justify-content:center;align-items:center;">
      <div style="background:#fff;padding:24px;border-radius:12px;max-width:600px;width:100%;
        position:relative;max-height:90vh;overflow-y:auto;font-family:sans-serif;">
        <button id="close-modal" style="position:absolute;top:12px;right:12px;font-size:24px;
          background:none;border:none;cursor:pointer">&times;</button>
        <h2 style="margin-bottom:20px;font-size:20px;">Shipping address</h2>
        <input id="addr1" placeholder="Address" style="width:100%;margin-bottom:10px;padding:8px"/>
        <input id="city" placeholder="City" style="width:100%;margin-bottom:10px;padding:8px"/>
        <input id="state" placeholder="State" style="width:100%;margin-bottom:10px;padding:8px"/>
        <input id="pin" placeholder="PIN Code" style="width:100%;margin-bottom:10px;padding:8px"/>
        <button id="submit-address" style="margin-top:15px;background:#070707;color:#fff;padding:10px;width:100%;
          border:none;border-radius:6px;cursor:pointer;">Submit</button>
      </div>
    </div>
  \`;

  if (!document.getElementById('modal-overlay')) {
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  function openModal() {
    document.getElementById('modal-overlay').style.display = 'flex';
  }

  function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
  }

  document.getElementById('close-modal')?.addEventListener('click', closeModal);

  /* -------------------- Add Button to Cart Page -------------------- */
  function injectButton() {
    if (document.getElementById('create-draft-order')) return;
    const cartFooter = document.querySelector('.cart__footer, form[action="/cart"], #CartDrawer');
    if (!cartFooter) return;

    const btn = document.createElement('button');
    btn.id = 'create-draft-order';
    btn.textContent = 'Create Draft Order';
    btn.style.cssText = "margin-top:15px;padding:12px 24px;background:#070707;color:#fff;border:none;border-radius:6px;cursor:pointer;width:100%";

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const cart = await fetchCart();
      if (!cart.items?.length) {
        showToast("Your cart is empty.");
        return;
      }
      openModal();
    });

    cartFooter.appendChild(btn);
  }

  document.addEventListener('DOMContentLoaded', injectButton);

  /* -------------------- Submit Handler -------------------- */
  document.getElementById('submit-address')?.addEventListener('click', async () => {
    const cart = await fetchCart();
    if (!cart.items?.length) {
      showToast("Cart is empty.");
      return;
    }

    const shop = getShopDomain();
    const address = {
      address1: document.getElementById('addr1').value,
      city: document.getElementById('city').value,
      state: document.getElementById('state').value,
      pin: document.getElementById('pin').value
    };

    try {
      const response = await fetch('https://draft-order-app-seven.vercel.app/api/create-draft-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer: window.customerData, cart, address, shop })
      });
      const result = await response.json();
      if (result.success) {
        await fetch('/cart/clear.js', { method: 'POST' });
        showToast("Draft order created!");
        closeModal();
      } else {
        showToast("Failed: " + result.error);
      }
    } catch (err) {
      console.error(err);
      showToast("Error creating draft order.");
    }
  });
})();
`;
