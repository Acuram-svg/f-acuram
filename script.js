const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const resultCount = document.getElementById("resultCount");
const cartCount = document.getElementById("cartCount");
const authStatus = document.getElementById("authStatus");
const openAuthBtn = document.getElementById("openAuthBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authForm = document.getElementById("authForm");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authModalTitle = document.getElementById("authModalTitle");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authSwitchLabel = document.getElementById("authSwitchLabel");
const authSwitchBtn = document.getElementById("authSwitchBtn");
const contactForm = document.getElementById("contactForm");

const detailTitle = document.getElementById("detailTitle");
const detailImage = document.getElementById("detailImage");
const detailDescription = document.getElementById("detailDescription");
const detailSpecs = document.getElementById("detailSpecs");
const detailPrice = document.getElementById("detailPrice");
const adminPanel = document.getElementById("adminPanel");
const adminAppForm = document.getElementById("adminAppForm");
const adminAppId = document.getElementById("adminAppId");
const adminAppName = document.getElementById("adminAppName");
const adminAppCategory = document.getElementById("adminAppCategory");
const adminAppPrice = document.getElementById("adminAppPrice");
const adminAppDesc = document.getElementById("adminAppDesc");
const adminAppSpecs = document.getElementById("adminAppSpecs");
const adminAppImage = document.getElementById("adminAppImage");
const adminAppImageExisting = document.getElementById("adminAppImageExisting");
const adminSaveBtn = document.getElementById("adminSaveBtn");
const adminCancelEditBtn = document.getElementById("adminCancelEditBtn");
const adminAppsTableBody = document.getElementById("adminAppsTableBody");
const adminSearchInput = document.getElementById("adminSearchInput");
const adminSortSelect = document.getElementById("adminSortSelect");
const adminCrudCount = document.getElementById("adminCrudCount");
const adminUndoBanner = document.getElementById("adminUndoBanner");
const adminUndoText = document.getElementById("adminUndoText");
const adminUndoBtn = document.getElementById("adminUndoBtn");
const adminSelectAll = document.getElementById("adminSelectAll");
const adminBulkDeleteBtn = document.getElementById("adminBulkDeleteBtn");
const adminSelectedCount = document.getElementById("adminSelectedCount");
const adminPageSizeSelect = document.getElementById("adminPageSizeSelect");
const adminPrevPageBtn = document.getElementById("adminPrevPageBtn");
const adminNextPageBtn = document.getElementById("adminNextPageBtn");
const adminPageInfo = document.getElementById("adminPageInfo");
const authFeatureBanner = document.getElementById("authFeatureBanner");
const authFeatureText = document.getElementById("authFeatureText");

const authModal = new bootstrap.Modal(document.getElementById("authModal"));
const detailModal = new bootstrap.Modal(document.getElementById("productDetailModal"));

let cartItems = 0;
let authMode = "signin";
let currentUser = null;
let authToken = null;
let products = [];
const API_BASE_URL = "http://localhost:5000/api";
const AUTH_STORAGE_KEY = "gg_auth_session";
let featureBannerTimeoutId = null;
const selectedAdminIds = new Set();
let adminCurrentPage = 1;
let adminPageSize = Number(adminPageSizeSelect.value);
let pendingDeleteBatch = null;

function formatPeso(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0
  }).format(value);
}

function sanitizeProducts(rawProducts) {
  if (!Array.isArray(rawProducts)) return [];
  return rawProducts.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof item.name === "string" &&
      typeof item.category === "string"
  );
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function getAdminFilteredSortedProducts() {
  const searchValue = adminSearchInput.value.trim().toLowerCase();
  const sortValue = adminSortSelect.value;

  return products
    .filter((product) => {
      if (!searchValue) return true;
      return (
        product.name.toLowerCase().includes(searchValue) ||
        product.category.toLowerCase().includes(searchValue)
      );
    })
    .sort((a, b) => {
      if (sortValue === "oldest") {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      if (sortValue === "priceAsc") {
        return Number(a.price || 0) - Number(b.price || 0);
      }
      if (sortValue === "priceDesc") {
        return Number(b.price || 0) - Number(a.price || 0);
      }
      if (sortValue === "nameAsc") {
        return a.name.localeCompare(b.name);
      }
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

function hideUndoBanner() {
  adminUndoBanner.classList.add("d-none");
  adminUndoText.textContent = "";
}

async function commitPendingDeleteBatch() {
  if (!pendingDeleteBatch) return;
  const batch = pendingDeleteBatch;
  pendingDeleteBatch = null;
  hideUndoBanner();

  const results = await Promise.allSettled(batch.items.map((item) => deleteApp(item._id)));
  const failedDeletes = results.filter((result) => result.status === "rejected").length;
  await loadProducts();

  if (failedDeletes) {
    showFeatureBanner(
      `${batch.items.length - failedDeletes} deleted, ${failedDeletes} failed. Please retry.`,
      "danger"
    );
  } else {
    showFeatureBanner(`${batch.items.length} app(s) deleted successfully.`, "success");
  }
}

async function queueDeleteItems(items) {
  if (!items.length) return;

  if (pendingDeleteBatch) {
    clearTimeout(pendingDeleteBatch.timerId);
    await commitPendingDeleteBatch();
  }

  pendingDeleteBatch = {
    items,
    timerId: setTimeout(() => {
      commitPendingDeleteBatch().catch(() => {
        showFeatureBanner("Delete operation failed.", "danger");
      });
    }, 5000)
  };

  const idsToDelete = new Set(items.map((item) => item._id));
  products = products.filter((product) => !idsToDelete.has(product._id));
  idsToDelete.forEach((id) => selectedAdminIds.delete(id));

  adminUndoText.textContent = `${items.length} app(s) will be deleted in 5 seconds.`;
  adminUndoBanner.classList.remove("d-none");

  initCategories();
  renderProducts();
  renderAdminApps();
}

function initCategories() {
  categoryFilter.innerHTML = "";
  const categories = ["All", ...new Set(products.map((p) => p.category))];
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category === "All" ? "All Categories" : category;
    categoryFilter.appendChild(option);
  });
}

function updateAuthUI() {
  if (currentUser) {
    authStatus.textContent = `Signed in: ${currentUser.name} (${currentUser.role})`;
    openAuthBtn.textContent = "Switch Account";
    logoutBtn.classList.remove("d-none");
  } else {
    authStatus.textContent = "Guest";
    openAuthBtn.textContent = "Sign In / Sign Up";
    logoutBtn.classList.add("d-none");
  }
  updateAdminUI();
}

function showFeatureBanner(message, type = "info") {
  if (featureBannerTimeoutId) {
    clearTimeout(featureBannerTimeoutId);
  }

  authFeatureText.textContent = message;
  authFeatureBanner.className = "alert mb-4";

  if (type === "success") {
    authFeatureBanner.classList.add("alert-success");
  } else if (type === "danger") {
    authFeatureBanner.classList.add("alert-danger");
  } else {
    authFeatureBanner.classList.add("alert-info");
  }

  featureBannerTimeoutId = setTimeout(() => {
    authFeatureBanner.classList.add("d-none");
  }, 3000);
}

function showAuthModal(mode) {
  authMode = mode;
  const isSignUp = mode === "signup";
  authModalTitle.textContent = isSignUp ? "Sign Up" : "Sign In";
  authSubmitBtn.textContent = isSignUp ? "Create Account" : "Sign In";
  authSwitchLabel.textContent = isSignUp ? "Already have an account?" : "No account yet?";
  authSwitchBtn.textContent = isSignUp ? "Sign In" : "Sign Up";
  authName.parentElement.style.display = isSignUp ? "block" : "none";
  authPassword.value = "";
  authModal.show();
}

async function apiRequest(endpoint, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed. Please try again.");
  }
  return data;
}

function getAuthHeaders() {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function toImageUrl(imagePath) {
  if (!imagePath) return "";
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  if (imagePath.startsWith("/")) {
    return `${API_BASE_URL.replace("/api", "")}${imagePath}`;
  }
  return `${API_BASE_URL.replace("/api", "")}/${imagePath}`;
}

function persistSession() {
  if (!authToken || !currentUser) return;
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({ token: authToken, user: currentUser })
  );
}

function clearSession() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

async function signup(payload) {
  return apiRequest("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function signin(payload) {
  return apiRequest("/auth/signin", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function fetchCurrentUser() {
  return apiRequest("/auth/me", {
    headers: {
      ...getAuthHeaders()
    }
  });
}

async function restoreSession() {
  const rawSession = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawSession) return;

  try {
    const savedSession = JSON.parse(rawSession);
    if (!savedSession?.token || !savedSession?.user) {
      clearSession();
      return;
    }
    authToken = savedSession.token;
    currentUser = await fetchCurrentUser();
    persistSession();
  } catch {
    clearSession();
  }
}

async function fetchApps() {
  return apiRequest("/apps");
}

async function createApp(formData) {
  return apiRequest("/apps", {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    },
    body: formData
  });
}

async function updateApp(appId, formData) {
  return apiRequest(`/apps/${appId}`, {
    method: "PUT",
    headers: {
      ...getAuthHeaders()
    },
    body: formData
  });
}

async function deleteApp(appId) {
  return apiRequest(`/apps/${appId}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeaders()
    }
  });
}

function updateAdminUI() {
  const isAdmin = currentUser && currentUser.role === "admin";
  adminPanel.classList.toggle("d-none", !isAdmin);
  if (isAdmin) {
    renderAdminApps();
  }
}

function renderAdminApps() {
  adminAppsTableBody.innerHTML = "";
  const filteredProducts = getAdminFilteredSortedProducts();
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / adminPageSize));
  adminCurrentPage = Math.min(Math.max(1, adminCurrentPage), totalPages);
  const startIndex = (adminCurrentPage - 1) * adminPageSize;
  const currentPageItems = filteredProducts.slice(startIndex, startIndex + adminPageSize);

  adminCrudCount.textContent = filteredProducts.length;
  adminSelectedCount.textContent = selectedAdminIds.size;
  adminBulkDeleteBtn.disabled = selectedAdminIds.size === 0;
  adminPageInfo.textContent = `Page ${adminCurrentPage} of ${totalPages}`;
  adminPrevPageBtn.disabled = adminCurrentPage <= 1;
  adminNextPageBtn.disabled = adminCurrentPage >= totalPages;

  if (!currentPageItems.length) {
    adminSelectAll.checked = false;
    adminSelectAll.indeterminate = false;
    adminAppsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">No matching apps. Try a different search or add a new one.</td>
      </tr>
    `;
    return;
  }

  const selectedOnPageCount = currentPageItems.filter((item) => selectedAdminIds.has(item._id)).length;
  adminSelectAll.checked = selectedOnPageCount === currentPageItems.length;
  adminSelectAll.indeterminate =
    selectedOnPageCount > 0 && selectedOnPageCount < currentPageItems.length;

  currentPageItems.forEach((product) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <input class="form-check-input admin-row-check" type="checkbox" data-id="${product._id}" ${
          selectedAdminIds.has(product._id) ? "checked" : ""
        } />
      </td>
      <td>${product.name}</td>
      <td>${product.category}</td>
      <td>${formatPeso(product.price)}</td>
      <td>${formatDate(product.updatedAt)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary me-1 duplicate-app-btn">Duplicate</button>
        <button class="btn btn-sm btn-outline-secondary me-1 edit-app-btn">Edit</button>
        <button class="btn btn-sm btn-outline-danger delete-app-btn">Delete</button>
      </td>
    `;

    row.querySelector(".edit-app-btn").addEventListener("click", () => {
      adminAppId.value = product._id;
      adminAppName.value = product.name;
      adminAppCategory.value = product.category;
      adminAppPrice.value = product.price;
      adminAppDesc.value = product.desc;
      adminAppSpecs.value = product.specs;
      adminAppImageExisting.value = product.image;
      adminAppImage.value = "";
      adminSaveBtn.textContent = "Update App";
      adminCancelEditBtn.classList.remove("d-none");
      adminPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    row.querySelector(".duplicate-app-btn").addEventListener("click", () => {
      adminAppId.value = "";
      adminAppName.value = `${product.name} Copy`;
      adminAppCategory.value = product.category;
      adminAppPrice.value = product.price;
      adminAppDesc.value = product.desc;
      adminAppSpecs.value = product.specs;
      adminAppImageExisting.value = "";
      adminAppImage.value = "";
      adminSaveBtn.textContent = "Save App";
      adminCancelEditBtn.classList.add("d-none");
      showFeatureBanner("Duplicated to form. Upload a new image and save.", "info");
      adminPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    row.querySelector(".delete-app-btn").addEventListener("click", async () => {
      if (!confirm(`Delete "${product.name}"?`)) return;
      try {
        await queueDeleteItems([product]);
      } catch (error) {
        alert(error.message);
      }
    });

    adminAppsTableBody.appendChild(row);
  });

  adminAppsTableBody.querySelectorAll(".admin-row-check").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const appId = checkbox.dataset.id;
      if (checkbox.checked) {
        selectedAdminIds.add(appId);
      } else {
        selectedAdminIds.delete(appId);
      }
      adminSelectedCount.textContent = selectedAdminIds.size;
      adminBulkDeleteBtn.disabled = selectedAdminIds.size === 0;
    });
  });
}

function resetAdminForm() {
  adminAppForm.reset();
  adminAppId.value = "";
  adminAppImageExisting.value = "";
  adminSaveBtn.textContent = "Save App";
  adminCancelEditBtn.classList.add("d-none");
}

async function loadProducts() {
  try {
    products = sanitizeProducts(await fetchApps());
    const validIds = new Set(products.map((item) => item._id));
    [...selectedAdminIds].forEach((id) => {
      if (!validIds.has(id)) selectedAdminIds.delete(id);
    });
  } catch (error) {
    products = [];
    alert(error.message || "Could not load apps from backend.");
  }
  initCategories();
  renderProducts();
  renderAdminApps();
}

function addToCart() {
  if (!currentUser) {
    alert("Please sign in first before adding items to your cart.");
    showAuthModal("signin");
    return;
  }
  cartItems += 1;
  cartCount.textContent = cartItems;
}

function openProductDetails(product) {
  detailTitle.textContent = product.name;
  detailImage.src = toImageUrl(product.image);
  detailImage.alt = product.name;
  detailDescription.textContent = product.desc;
  detailSpecs.innerHTML = `<strong>Specs:</strong> ${product.specs}`;
  detailPrice.textContent = formatPeso(product.price);
  detailModal.show();
}

function renderProducts() {
  const searchText = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;

  const filtered = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchText);
    const matchesCategory =
      selectedCategory === "All" ||
      selectedCategory === "All Categories" ||
      product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  resultCount.textContent = filtered.length;
  productGrid.innerHTML = "";

  if (!filtered.length) {
    productGrid.innerHTML = `
      <div class="col-12">
        <div class="alert alert-warning mb-0">
          No products matched your search. Try a different keyword or category.
        </div>
      </div>
    `;
    return;
  }

  filtered.forEach((product) => {
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-lg-4 col-xl-3";
    col.innerHTML = `
      <article class="product-card p-3 d-flex flex-column">
        <img src="${toImageUrl(product.image)}" alt="${product.name}" class="product-image mb-3" />
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge product-badge">${product.category}</span>
          <span class="price-tag">${formatPeso(product.price)}</span>
        </div>
        <h6 class="fw-bold mb-2">${product.name}</h6>
        <p class="text-muted small mb-3">${product.desc}</p>
        <div class="mt-auto d-grid gap-2">
          <button class="btn btn-outline-secondary details-btn">View Details</button>
          <button class="btn btn-gg-primary add-btn">Add to Cart</button>
        </div>
      </article>
    `;

    col.querySelector(".add-btn").addEventListener("click", addToCart);
    col.querySelector(".details-btn").addEventListener("click", () => openProductDetails(product));
    productGrid.appendChild(col);
  });
}

openAuthBtn.addEventListener("click", () => showAuthModal("signin"));
authSwitchBtn.addEventListener("click", () => showAuthModal(authMode === "signin" ? "signup" : "signin"));
logoutBtn.addEventListener("click", () => {
  clearSession();
  updateAuthUI();
  showFeatureBanner("You are now logged out.", "info");
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const name = authName.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    alert("Please enter your email and password.");
    return;
  }

  const originalBtnText = authSubmitBtn.textContent;
  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = "Please wait...";

  try {
    if (authMode === "signup") {
      if (!name) {
        alert("Please enter your name for sign up.");
        return;
      }

      const data = await signup({ name, email, password });
      authToken = data.token;
      currentUser = data.user;
      persistSession();
      showFeatureBanner("Account created and signed in successfully.", "success");
    } else {
      const data = await signin({ email, password });
      authToken = data.token;
      currentUser = data.user;
      persistSession();
      showFeatureBanner(`Welcome back, ${data.user.name}! Signed in successfully.`, "success");
    }

    updateAuthUI();
    authForm.reset();
    authModal.hide();
  } catch (error) {
    alert(error.message || "Unable to reach backend. Make sure server is running on port 5000.");
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = originalBtnText;
  }
});

adminAppForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser || currentUser.role !== "admin") {
    alert("Only admin users can manage apps.");
    return;
  }

  const payload = new FormData();
  payload.append("name", adminAppName.value.trim());
  payload.append("category", adminAppCategory.value.trim());
  payload.append("price", Number(adminAppPrice.value));
  payload.append("desc", adminAppDesc.value.trim());
  payload.append("specs", adminAppSpecs.value.trim());
  const hasNewImage = Boolean(adminAppImage.files?.[0]);
  const isCreateMode = !adminAppId.value;

  if (isCreateMode && !hasNewImage) {
    alert("Please upload a product image.");
    return;
  }

  if (adminAppImage.files?.[0]) {
    payload.append("image", adminAppImage.files[0]);
  }
  if (adminAppImageExisting.value) {
    payload.append("existingImage", adminAppImageExisting.value);
  }

  try {
    adminSaveBtn.disabled = true;
    adminSaveBtn.textContent = adminAppId.value ? "Updating..." : "Saving...";
    if (adminAppId.value) {
      await updateApp(adminAppId.value, payload);
      showFeatureBanner("App updated successfully.", "success");
    } else {
      await createApp(payload);
      showFeatureBanner("App created successfully.", "success");
    }
    resetAdminForm();
    await loadProducts();
  } catch (error) {
    alert(error.message);
  } finally {
    adminSaveBtn.disabled = false;
    adminSaveBtn.textContent = "Save App";
  }
});

adminCancelEditBtn.addEventListener("click", resetAdminForm);
adminSearchInput.addEventListener("input", () => {
  adminCurrentPage = 1;
  renderAdminApps();
});
adminSortSelect.addEventListener("change", () => {
  adminCurrentPage = 1;
  renderAdminApps();
});
adminPageSizeSelect.addEventListener("change", () => {
  adminPageSize = Number(adminPageSizeSelect.value) || 10;
  adminCurrentPage = 1;
  renderAdminApps();
});
adminPrevPageBtn.addEventListener("click", () => {
  adminCurrentPage = Math.max(1, adminCurrentPage - 1);
  renderAdminApps();
});
adminNextPageBtn.addEventListener("click", () => {
  adminCurrentPage += 1;
  renderAdminApps();
});
adminSelectAll.addEventListener("change", () => {
  const filteredProducts = getAdminFilteredSortedProducts();
  const startIndex = (adminCurrentPage - 1) * adminPageSize;
  const currentPageItems = filteredProducts.slice(startIndex, startIndex + adminPageSize);

  currentPageItems.forEach((item) => {
    if (adminSelectAll.checked) {
      selectedAdminIds.add(item._id);
    } else {
      selectedAdminIds.delete(item._id);
    }
  });
  renderAdminApps();
});
adminBulkDeleteBtn.addEventListener("click", async () => {
  const selectedItems = products.filter((item) => selectedAdminIds.has(item._id));
  if (!selectedItems.length) return;
  if (!confirm(`Delete ${selectedItems.length} selected app(s)?`)) return;
  await queueDeleteItems(selectedItems);
});
adminUndoBtn.addEventListener("click", () => {
  if (!pendingDeleteBatch) return;
  clearTimeout(pendingDeleteBatch.timerId);
  products = [...pendingDeleteBatch.items, ...products];
  pendingDeleteBatch = null;
  hideUndoBanner();
  initCategories();
  renderProducts();
  renderAdminApps();
  showFeatureBanner("Delete undone. Apps restored.", "success");
});

contactForm.addEventListener("submit", (e) => {
  e.preventDefault();
  alert("Thank you for contacting Gadget Galore. We will reply soon.");
  contactForm.reset();
});

async function initializeApp() {
  await loadProducts();
  await restoreSession();
  updateAuthUI();
}

initializeApp();

searchInput.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);
