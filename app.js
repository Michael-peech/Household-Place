const API_URL = "https://harbinger.pythonanywhere.com/api";
let products = [];
let cart = {}; 
let activeCategory = 'All';
let activeTag = 'All';
let searchQuery = ''; 

// SET YOUR MANAGER PIN HERE
const ADMIN_PIN = "1234";
let targetRestrictedView = ''; 

async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        products = await response.json();
        renderCategories();
        renderTags();
        renderProducts();
        renderAdminInventory();
    } catch (error) { console.error("Database connection error:", error); }
}

function switchView(viewName) {
    if (viewName === 'admin' || viewName === 'reports') {
        targetRestrictedView = viewName;
        document.getElementById('admin-pin-input').value = '';
        document.getElementById('pin-modal').classList.add('active');
        setTimeout(() => document.getElementById('admin-pin-input').focus(), 100);
        return; 
    }
    
    executeViewSwitch(viewName);
}

function verifyPin() {
    const enteredPin = document.getElementById('admin-pin-input').value;
    if (enteredPin === ADMIN_PIN) {
        closeModal('pin-modal');
        executeViewSwitch(targetRestrictedView);
    } else {
        alert("Incorrect Manager PIN.");
        document.getElementById('admin-pin-input').value = '';
        document.getElementById('admin-pin-input').focus();
    }
}

function checkPin(event) {
    if (event.key === 'Enter') {
        verifyPin();
    }
}

function executeViewSwitch(viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links button').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`view-${viewName}`).classList.add('active');
    document.getElementById(`btn-${viewName}`).classList.add('active');
    
    if(viewName === 'checkout') renderCheckout();
    if(viewName === 'reports') loadReports();
}

function handleSearch(query) {
    searchQuery = query.toLowerCase().trim();
    renderProducts();
}

function renderCategories() {
    const container = document.getElementById('category-filters');
    const categories = ['All', ...new Set(products.map(p => p.category))];
    
    container.innerHTML = categories.map(cat => `
        <button class="cat-btn ${cat === activeCategory ? 'active' : ''}" 
                onclick="setCategory('${cat}')">${cat}</button>
    `).join('');
}

function setCategory(cat) {
    activeCategory = cat;
    renderCategories();
    renderProducts();
}

function renderTags() {
    const list = document.getElementById('tag-list');
    let allTags = new Set();
    
    products.forEach(p => {
        if (p.tags && p.tags.trim() !== '') {
            p.tags.split(',').forEach(tag => {
                allTags.add(tag.trim().toLowerCase());
            });
        }
    });
    
    const tags = ['All', ...Array.from(allTags).sort()];
    
    list.innerHTML = tags.map(tag => `
        <div class="dropdown-item ${tag === activeTag ? 'active' : ''}" 
             onclick="setTag('${tag}')">${tag.charAt(0).toUpperCase() + tag.slice(1)}</div>
    `).join('');

    const filterBtn = document.querySelector('.filter-icon-btn');
    if (filterBtn) {
        if (activeTag !== 'All') {
            filterBtn.style.color = 'var(--primary)';
            filterBtn.style.borderColor = 'var(--primary)';
            filterBtn.style.background = '#eff6ff';
        } else {
            filterBtn.style.color = 'var(--text-muted)';
            filterBtn.style.borderColor = 'var(--border)';
            filterBtn.style.background = 'var(--surface-color)';
        }
    }
}

function setTag(tag) {
    activeTag = tag;
    renderTags();
    renderProducts();
    document.getElementById('tag-dropdown-menu').classList.remove('show');
}

function toggleTagDropdown() {
    document.getElementById('tag-dropdown-menu').classList.toggle('show');
}

window.onclick = function(event) {
    if (!event.target.closest('.tag-dropdown')) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            if (dropdowns[i].classList.contains('show')) {
                dropdowns[i].classList.remove('show');
            }
        }
    }
    
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

function renderProducts() {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';
    
    const filtered = products.filter(p => {
        const matchCategory = activeCategory === 'All' || p.category === activeCategory;
        
        let matchTag = true;
        if (activeTag !== 'All') {
            const productTags = p.tags ? p.tags.split(',').map(t => t.trim().toLowerCase()) : [];
            matchTag = productTags.includes(activeTag.toLowerCase());
        }
        
        const matchSearch = searchQuery === '' || p.name.toLowerCase().includes(searchQuery);
        
        return matchCategory && matchTag && matchSearch;
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">No products found matching your criteria.</div>`;
        return;
    }
    
    filtered.forEach(product => {
        const inCart = cart[product.id] ? cart[product.id].quantity : 0;
        const availableStock = product.stock - inCart;
        const isOutOfStock = availableStock <= 0;
        
        const card = document.createElement('div');
        card.className = `product-card ${isOutOfStock ? 'out-of-stock' : ''}`;
        
        if (!isOutOfStock) {
            card.onclick = () => addToCart(product.id);
        }
        
        let eyeIconHtml = '';
        if (product.image_data && typeof product.image_data === 'string' && product.image_data.trim() !== '') {
            const eyeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
            eyeIconHtml = `<button class="eye-btn" onclick="openImageView(event, '${product.image_data}', '${product.name.replace(/'/g, "\\'")}')">${eyeSvg}</button>`;
        }
        
        card.innerHTML = `
            ${eyeIconHtml}
            <div class="product-name">${product.name}</div>
            <div class="product-price">₦${product.price.toLocaleString()}</div>
            <div class="cost-reveal" onclick="toggleCost(event, this)">Floor: <span>₦${product.cost_price.toLocaleString()}</span></div>
            ${isOutOfStock ? '<div class="out-of-stock-label">Out of Stock</div>' : ''}
        `;
        
        grid.appendChild(card);
    });
}

function openImageView(event, base64Data, productName) {
    event.stopPropagation();
    document.getElementById('preview-image').src = base64Data;
    document.getElementById('preview-title').innerText = productName;
    document.getElementById('image-view-modal').classList.add('active');
}

function toggleCost(event, element) {
    event.stopPropagation(); 
    element.classList.add('active');
    setTimeout(() => {
        element.classList.remove('active');
    }, 3000);
}

// --- Cart Logic ---
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const currentQty = cart[productId] ? cart[productId].quantity : 0;
    
    if (currentQty >= product.stock) {
        alert(`You only have ${product.stock} of ${product.name} in stock!`);
        return;
    }

    if (!cart[productId]) {
        cart[productId] = { quantity: 1, price: product.price };
    } else {
        cart[productId].quantity++;
    }
    updateBadge();
    renderProducts(); 
}

function updateBadge() {
    const badge = document.getElementById('cart-badge');
    const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
    badge.innerText = totalItems;
    
    const icon = document.getElementById('btn-checkout');
    icon.classList.remove('pulse');
    void icon.offsetWidth;
    icon.classList.add('pulse');
}

function getSmartWarning(product, currentPrice) {
    const expectedProfit = product.price - product.cost_price;
    const actualProfit = currentPrice - product.cost_price;
    
    if (actualProfit < 0) {
        return `<div class="price-warning warning-red">🚨 Critical: You are selling this below cost price!</div>`;
    } 
    else if (actualProfit <= expectedProfit * 0.2) {
        return `<div class="price-warning warning-red">⚠️ Danger: This price wipes out almost all your profit.</div>`;
    } 
    else if (actualProfit <= expectedProfit * 0.5) {
        return `<div class="price-warning warning-orange">⚠️ Careful: You are cutting your profit margin by more than half.</div>`;
    }
    
    return `<div class="price-warning"></div>`;
}

function renderCheckout() {
    const list = document.getElementById('checkout-list');
    const totalEl = document.getElementById('checkout-total');
    list.innerHTML = '';
    let grandTotal = 0;

    if (Object.keys(cart).length === 0) {
        list.innerHTML = '<p style="text-align:center; color:gray;">Your cart is empty.</p>';
    } else {
        for (const [id, data] of Object.entries(cart)) {
            const product = products.find(p => p.id == id);
            const itemTotal = data.price * data.quantity;
            grandTotal += itemTotal;
            
            const warningHtml = getSmartWarning(product, data.price);

            list.innerHTML += `
                <div class="checkout-item">
                    <div class="item-info">
                        <h3>${product.name}</h3>
                        <div class="price-input-container">
                            <span>@ ₦</span>
                            <input type="number" class="price-input" value="${data.price}" 
                                   onkeyup="handlePriceChange(${id}, this.value)" 
                                   onchange="handlePriceChange(${id}, this.value)">
                            <span>each</span>
                        </div>
                        <div id="warning-container-${id}">${warningHtml}</div>
                    </div>
                    <div class="item-controls">
                        <button class="qty-btn" onclick="updateQty(${id}, -1)">-</button>
                        <span>${data.quantity}</span>
                        <button class="qty-btn" onclick="updateQty(${id}, 1)">+</button>
                        <div class="item-total" id="item-total-${id}">₦${itemTotal.toLocaleString()}</div>
                        <button class="remove-btn" onclick="deleteItem(${id})">Remove</button>
                    </div>
                </div>
            `;
        }
    }
    totalEl.innerText = `₦${grandTotal.toLocaleString()}`;
}

function handlePriceChange(id, newPriceStr) {
    let newPrice = parseInt(newPriceStr);
    if (isNaN(newPrice)) {
        newPrice = 0;
    }
    
    cart[id].price = newPrice;
    const product = products.find(p => p.id == id);
    
    document.getElementById(`warning-container-${id}`).innerHTML = getSmartWarning(product, newPrice);
    document.getElementById(`item-total-${id}`).innerText = `₦${(newPrice * cart[id].quantity).toLocaleString()}`;
    
    let grandTotal = 0;
    for (const [cartId, data] of Object.entries(cart)) {
        grandTotal += data.price * data.quantity;
    }
    document.getElementById('checkout-total').innerText = `₦${grandTotal.toLocaleString()}`;
}

function updateQty(id, change) {
    if(cart[id]) {
        const product = products.find(p => p.id == id);
        const newQty = cart[id].quantity + change;
        
        if (newQty > product.stock) {
            alert(`Cannot add more. Only ${product.stock} left in stock.`);
            return;
        }
        
        cart[id].quantity = newQty;
        if(cart[id].quantity <= 0) delete cart[id];
    }
    updateBadge();
    renderCheckout();
    renderProducts(); 
}

function deleteItem(id) {
    delete cart[id];
    updateBadge();
    renderCheckout();
    renderProducts(); 
}

async function completeCheckout() {
    if (Object.keys(cart).length === 0) return alert("Cart is empty!");
    
    const payload = {
        payment_method: document.getElementById('payment-type').value,
        items: cart
    };

    try {
        const response = await fetch(`${API_URL}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            alert(`Sale Completed via ${payload.payment_method.toUpperCase()}!`);
            cart = {}; 
            updateBadge();
            loadProducts(); 
            switchView('pos');
            
            document.getElementById('search-input').value = '';
            searchQuery = '';
            activeCategory = 'All';
            activeTag = 'All';
            renderCategories();
            renderTags();
            
        } else {
            console.error(await response.text());
            alert("Checkout failed. Server error.");
        }
    } catch (error) { console.error("Checkout failed:", error); }
}

// --- Admin Panel Logic ---
function renderAdminInventory() {
    const tbody = document.getElementById('inventory-list');
    tbody.innerHTML = '';
    
    products.forEach(product => {
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 500">${product.name}</td>
                <td><span class="cat-btn">${product.category}</span></td>
                <td style="color: gray;">₦${product.cost_price.toLocaleString()}</td>
                <td>₦${product.price.toLocaleString()}</td>
                <td>${product.stock}</td>
                <td style="display: flex; gap: 0.5rem; align-items: center;">
                    <button onclick="openProductModal(${product.id})" style="color: var(--primary); background: none; border: none; cursor: pointer;">Edit</button>
                    <button onclick="deleteProduct(${product.id})" style="color: #ef4444; background: none; border: none; cursor: pointer;" title="Delete Product">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
            </tr>
        `;
    });
}

function closeModal(modalId) { document.getElementById(modalId).classList.remove('active'); }

function openProductModal(id = null) {
    const modal = document.getElementById('product-modal');
    if (id) {
        const p = products.find(p => p.id === id);
        document.getElementById('modal-title').innerText = "Edit Product";
        document.getElementById('product-id').value = p.id;
        document.getElementById('product-name').value = p.name;
        document.getElementById('product-category').value = p.category;
        document.getElementById('product-tags').value = p.tags || "";
        document.getElementById('product-cost').value = p.cost_price;
        document.getElementById('product-price').value = p.price;
        document.getElementById('product-stock').value = p.stock;
    } else {
        document.getElementById('modal-title').innerText = "Add New Product";
        document.getElementById('product-id').value = "";
        document.getElementById('product-name').value = "";
        document.getElementById('product-category').value = "";
        document.getElementById('product-tags').value = "";
        document.getElementById('product-cost').value = "";
        document.getElementById('product-price').value = "";
        document.getElementById('product-stock').value = "";
        document.getElementById('product-image-file').value = "";
        document.getElementById('product-image-base64').value = "";
    }
    modal.classList.add('active');
}

async function saveProduct() {
    const id = document.getElementById('product-id').value;
    const fileInput = document.getElementById('product-image-file');
    let base64String = document.getElementById('product-image-base64').value;

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        base64String = await new Promise((resolve) => {
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
    }

    const payload = {
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value || "Uncategorized",
        tags: document.getElementById('product-tags').value || "",
        cost_price: parseInt(document.getElementById('product-cost').value) || 0,
        price: parseInt(document.getElementById('product-price').value) || 0,
        stock: parseInt(document.getElementById('product-stock').value) || 0,
        image_data: base64String || ""
    };

    const url = id ? `${API_URL}/products/${id}` : `${API_URL}/products`;
    const method = id ? "PUT" : "POST";

    await fetch(url, { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    closeModal('product-modal');
    loadProducts();
}

async function deleteProduct(id) {
    if (confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
        try {
            const response = await fetch(`${API_URL}/products/${id}`, { method: "DELETE" });
            if (response.ok) {
                loadProducts(); 
            } else {
                alert("Failed to delete product. Server error.");
            }
        } catch (error) {
            console.error("Failed to delete product:", error);
        }
    }
}

loadProducts();

// --- Reports & Analytics Logic ---
let allTransactions = []; 
let currentFilteredTx = [];
let barChartInstance = null;
let pieChartInstance = null;

async function loadReports() {
    try {
        const response = await fetch(`${API_URL}/reports/sales`);
        allTransactions = await response.json();
        
        const today = new Date();
        document.getElementById('filter-month').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        
        filterReports(); 
    } catch (error) { console.error("Failed to load reports:", error); }
}

function filterReports() {
    const monthStr = document.getElementById('filter-month').value;
    
    if (monthStr) {
        const [year, month] = monthStr.split('-');
        currentFilteredTx = allTransactions.filter(tx => {
            const txDate = new Date(tx.timestamp);
            return txDate.getFullYear() == year && (txDate.getMonth() + 1) == month;
        });
    } else {
        currentFilteredTx = allTransactions;
    }
    
    renderTransactionFeed();
    updateCharts();
}

function renderTransactionFeed() {
    let totalRevenue = 0;
    let totalProfit = 0;
    
    const feed = document.getElementById('transaction-feed');
    feed.innerHTML = '';
    
    if (currentFilteredTx.length === 0) {
        feed.innerHTML = '<p style="text-align:center; padding: 2rem; color: gray;">No transactions for this month.</p>';
    }
    
    currentFilteredTx.forEach(tx => {
        totalRevenue += tx.total_amount;
        let txProfit = 0;
        tx.items.forEach(item => {
            txProfit += (item.price_sold_at - item.cost_price) * item.quantity;
        });
        totalProfit += txProfit;
        tx.calculatedProfit = txProfit; 
        
        const dateObj = new Date(tx.timestamp);
        const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + 
                              dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        
        const paymentMethodFormatted = tx.payment_method.charAt(0).toUpperCase() + tx.payment_method.slice(1);
        
        // UPGRADED: The entire row is now clickable and opens the receipt modal
        feed.innerHTML += `
            <div class="feed-item" onclick='viewReceipt(${JSON.stringify(tx)})'>
                <div class="feed-left">
                    <div class="feed-icon success">✅</div>
                    <div>
                        <div class="feed-title">Completed Sale || ${paymentMethodFormatted}</div>
                        <div class="feed-time">${formattedDate}</div>
                    </div>
                </div>
                <div class="feed-right">
                    <div class="feed-amount">₦${tx.total_amount.toLocaleString()}</div>
                </div>
            </div>
        `;
    });
    
    document.getElementById('report-revenue').innerText = `₦${totalRevenue.toLocaleString()}`;
    document.getElementById('report-profit').innerText = `₦${totalProfit.toLocaleString()}`;
}

function viewReceipt(tx) {
    const detailsDiv = document.getElementById('receipt-details');
    const dateObj = new Date(tx.timestamp);
    
    let itemsHtml = '';
    tx.items.forEach(item => {
        itemsHtml += `
            <div class="receipt-item">
                <span>${item.quantity}x ${item.product_name}</span>
                <span>₦${(item.price_sold_at * item.quantity).toLocaleString()}</span>
            </div>
        `;
    });

    detailsDiv.innerHTML = `
        <p style="color: gray; font-size: 0.85rem; margin-bottom: 1rem;">${dateObj.toLocaleString()}<br>Method: ${tx.payment_method.toUpperCase()}</p>
        ${itemsHtml}
        <div class="receipt-total">
            <span>Total Paid</span>
            <span>₦${tx.total_amount.toLocaleString()}</span>
        </div>
    `;
    
    document.getElementById('receipt-modal').classList.add('active');
}

function toggleAnalytics() {
    const feed = document.getElementById('transaction-feed');
    const analytics = document.getElementById('analytics-view');
    const btn = document.querySelector('.analysis-btn');
    
    if (feed.style.display === 'none') {
        feed.style.display = 'flex';
        analytics.style.display = 'none';
        btn.innerText = 'Analysis';
        btn.style.backgroundColor = '#10b981';
    } else {
        feed.style.display = 'none';
        analytics.style.display = 'block';
        btn.innerText = 'Transactions';
        btn.style.backgroundColor = 'var(--primary)';
        updateCharts();
    }
}

function updateCharts() {
    if (document.getElementById('analytics-view').style.display === 'none') return;
    updateBarChart();
    updatePieChart();
}

function updateBarChart() {
    const ctx = document.getElementById('barChart').getContext('2d');
    const showProfit = document.getElementById('chart-type-toggle').value === 'profit';
    
    const dailyData = {};
    currentFilteredTx.forEach(tx => {
        const day = new Date(tx.timestamp).getDate();
        if (!dailyData[day]) dailyData[day] = 0;
        dailyData[day] += showProfit ? tx.calculatedProfit : tx.total_amount;
    });

    const labels = Object.keys(dailyData).map(day => `Day ${day}`);
    const data = Object.values(dailyData);

    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: showProfit ? 'Gross Profit (₦)' : 'Daily Revenue (₦)',
                data: data,
                backgroundColor: showProfit ? '#10b981' : '#3b82f6',
                borderRadius: 4
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
}

function updatePieChart() {
    const ctx = document.getElementById('pieChart').getContext('2d');
    
    let cash = 0, transfer = 0, pos = 0;
    currentFilteredTx.forEach(tx => {
        if(tx.payment_method === 'cash') cash += tx.total_amount;
        if(tx.payment_method === 'transfer') transfer += tx.total_amount;
        if(tx.payment_method === 'pos') pos += tx.total_amount;
    });

    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Cash', 'Transfer', 'POS'],
            datasets: [{
                data: [cash, transfer, pos],
                backgroundColor: ['#f59e0b', '#3b82f6', '#10b981'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: true }
    });
}
