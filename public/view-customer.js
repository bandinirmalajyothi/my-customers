import { db, storage } from './firebase-config.js';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

let currentCustomerId = null;
let currentCustomer = null;
let photoFile = null;
let lineItems = [];
let lineItemCounter = 0;

// Show loading indicator
function showLoading(show = true) {
  document.getElementById('loadingIndicator').classList.toggle('hidden', !show);
}

// Show notification
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`;
  notification.classList.remove('hidden');
  
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 3000);
}

// Show confirmation modal
function showConfirmModal(callback) {
  const modal = document.getElementById('confirmModal');
  modal.classList.remove('hidden');
  
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  const cancelBtn = document.getElementById('cancelDeleteBtn');
  
  const handleConfirm = () => {
    modal.classList.add('hidden');
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
    callback();
  };
  
  const handleCancel = () => {
    modal.classList.add('hidden');
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
  };
  
  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);
}

// Get customer ID from URL
function getCustomerIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// Load customer data
async function loadCustomer(customerId) {
  showLoading(true);
  try {
    const docRef = doc(db, 'customers', customerId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      currentCustomer = { id: docSnap.id, ...docSnap.data() };
      populateForm();
      loadInvoices();
    } else {
      showNotification('Customer not found', 'error');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    }
  } catch (error) {
    console.error('Error loading customer:', error);
    showNotification('Error loading customer', 'error');
  } finally {
    showLoading(false);
  }
}

// Populate form with customer data
function populateForm() {
  document.getElementById('name').value = currentCustomer.name || '';
  document.getElementById('status').value = currentCustomer.status || 'Planning';
  document.getElementById('balance').value = currentCustomer.balance || 0;
  document.getElementById('notes').value = currentCustomer.notes || '';
  
  if (currentCustomer.photoURL) {
    displayPhoto(currentCustomer.photoURL);
  }
}

// Display photo
function displayPhoto(url) {
  const preview = document.getElementById('photoPreview');
  preview.innerHTML = `<img src="${url}" alt="Customer photo" class="w-full h-full object-cover">`;
}

// Handle photo file selection
document.getElementById('photoInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      showNotification('File size must be less than 5MB', 'error');
      return;
    }
    
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showNotification('Only JPG, PNG, and WebP files are allowed', 'error');
      return;
    }
    
    photoFile = file;
    const reader = new FileReader();
    reader.onload = (event) => {
      displayPhoto(event.target.result);
    };
    reader.readAsDataURL(file);
  }
});

// Upload photo to Cloud Storage
async function uploadPhoto() {
  if (!photoFile) return null;
  
  try {
    const timestamp = Date.now();
    const filename = `customers/${currentCustomerId}/${timestamp}_${photoFile.name}`;
    const storageRef = ref(storage, filename);
    
    await uploadBytes(storageRef, photoFile);
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading photo:', error);
    showNotification('Error uploading photo', 'error');
    throw error;
  }
}

// Save customer
document.getElementById('customerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  showLoading(true);
  try {
    const formData = {
      name: document.getElementById('name').value,
      status: document.getElementById('status').value,
      balance: parseFloat(document.getElementById('balance').value) || 0,
      notes: document.getElementById('notes').value
    };
    
    if (photoFile) {
      const photoURL = await uploadPhoto();
      formData.photoURL = photoURL;
      photoFile = null;
      document.getElementById('photoInput').value = '';
    }
    
    const customerRef = doc(db, 'customers', currentCustomerId);
    await updateDoc(customerRef, formData);
    
    currentCustomer = { ...currentCustomer, ...formData };
    showNotification('Customer saved successfully!');
  } catch (error) {
    console.error('Error saving customer:', error);
    showNotification('Error saving customer', 'error');
  } finally {
    showLoading(false);
  }
});

// Delete customer
document.getElementById('deleteBtn').addEventListener('click', () => {
  showConfirmModal(async () => {
    showLoading(true);
    try {
      const customerRef = doc(db, 'customers', currentCustomerId);
      await deleteDoc(customerRef);
      showNotification('Customer deleted successfully!');
      
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    } catch (error) {
      console.error('Error deleting customer:', error);
      showNotification('Error deleting customer', 'error');
    } finally {
      showLoading(false);
    }
  });
});

// ===== INVOICE FUNCTIONALITY =====

// Open invoice modal
document.getElementById('invoiceBtn').addEventListener('click', () => {
  document.getElementById('invoiceModal').classList.remove('hidden');
  document.getElementById('invoiceDate').valueAsDate = new Date();
  document.getElementById('clientName').value = currentCustomer.name || '';
  lineItems = [];
  lineItemCounter = 0;
  document.getElementById('lineItemsContainer').innerHTML = '';
  addLineItem();
  updateGrandTotal();
});

// Close invoice modal
document.getElementById('closeInvoiceModalBtn').addEventListener('click', () => {
  document.getElementById('invoiceModal').classList.add('hidden');
});

// Add line item
function addLineItem(description = '', quantity = '', price = '') {
  lineItemCounter++;
  const itemId = lineItemCounter;
  
  const container = document.getElementById('lineItemsContainer');
  const itemDiv = document.createElement('div');
  itemDiv.id = `line-item-${itemId}`;
  itemDiv.className = 'border border-gray-200 rounded p-3 bg-gray-50';
  itemDiv.innerHTML = `
    <div class="grid grid-cols-12 gap-2">
      <input type="text" placeholder="Description" value="${description}" class="col-span-5 px-2 py-1 border border-gray-300 rounded text-sm line-item-description" data-item-id="${itemId}">
      <input type="number" placeholder="Qty" value="${quantity}" step="0.01" min="0" class="col-span-2 px-2 py-1 border border-gray-300 rounded text-sm line-item-quantity" data-item-id="${itemId}">
      <input type="number" placeholder="Price" value="${price}" step="0.01" min="0" class="col-span-3 px-2 py-1 border border-gray-300 rounded text-sm line-item-price" data-item-id="${itemId}">
      <button type="button" class="col-span-2 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm font-semibold transition" onclick="removeLineItem(${itemId})">
        Delete
      </button>
    </div>
  `;
  
  container.appendChild(itemDiv);
  
  const inputs = itemDiv.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('change', updateGrandTotal);
    input.addEventListener('input', updateGrandTotal);
  });
}

// Remove line item
function removeLineItem(itemId) {
  const itemDiv = document.getElementById(`line-item-${itemId}`);
  if (itemDiv) {
    itemDiv.remove();
    updateGrandTotal();
  }
}

// Make removeLineItem global
window.removeLineItem = removeLineItem;

// Add line item button
document.getElementById('addLineItemBtn').addEventListener('click', () => {
  addLineItem();
});

// Update grand total
function updateGrandTotal() {
  let total = 0;
  document.querySelectorAll('#lineItemsContainer .line-item-quantity').forEach(qtyInput => {
    const itemId = qtyInput.dataset.itemId;
    const priceInput = document.querySelector(`.line-item-price[data-item-id="${itemId}"]`);
    const qty = parseFloat(qtyInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    total += qty * price;
  });
  
  document.getElementById('grandTotal').textContent = total.toFixed(2);
}

// Generate invoice PDF
async function generateInvoicePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  const date = document.getElementById('invoiceDate').value;
  const invoiceNumber = document.getElementById('invoiceNumber').value;
  const businessName = document.getElementById('businessName').value;
  const clientName = document.getElementById('clientName').value;
  
  // Header
  doc.setFontSize(20);
  doc.text('INVOICE', 20, 20);
  
  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoiceNumber}`, 20, 30);
  doc.text(`Date: ${date}`, 20, 36);
  
  // Business info
  doc.setFontSize(12);
  doc.text('From:', 20, 50);
  doc.setFontSize(10);
  doc.text(businessName, 20, 56);
  
  // Client info
  doc.setFontSize(12);
  doc.text('Bill To:', 120, 50);
  doc.setFontSize(10);
  doc.text(clientName, 120, 56);
  
  // Line items table
  const tableData = [];
  document.querySelectorAll('#lineItemsContainer .line-item-quantity').forEach((qtyInput) => {
    const itemId = qtyInput.dataset.itemId;
    const description = document.querySelector(`.line-item-description[data-item-id="${itemId}"]`).value;
    const quantity = qtyInput.value;
    const price = document.querySelector(`.line-item-price[data-item-id="${itemId}"]`).value;
    const amount = (parseFloat(quantity) * parseFloat(price)).toFixed(2);
    
    tableData.push([description, quantity, `$${parseFloat(price).toFixed(2)}`, `$${amount}`]);
  });
  
  if (tableData.length > 0) {
    doc.autoTable({
      head: [['Description', 'Qty', 'Price', 'Amount']],
      body: tableData,
      startY: 70,
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' }
      }
    });
  }
  
  // Grand total
  const finalY = doc.lastAutoTable?.finalY || 130;
  const grandTotal = document.getElementById('grandTotal').textContent;
  doc.setFontSize(12);
  doc.text(`Grand Total: $${grandTotal}`, 120, finalY + 10);
  
  return doc;
}

// Submit invoice form
document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  showLoading(true);
  try {
    // Generate PDF
    const doc = await generateInvoicePDF();
    const pdfBlob = doc.output('blob');
    
    // Upload PDF to Cloud Storage
    const invoiceDate = new Date().getTime();
    const invoiceNumber = document.getElementById('invoiceNumber').value;
    const filename = `invoices/${currentCustomerId}/${invoiceDate}_${invoiceNumber}.pdf`;
    const storageRef = ref(storage, filename);
    
    await uploadBytes(storageRef, pdfBlob);
    const downloadURL = await getDownloadURL(storageRef);
    
    // Save invoice metadata to Firestore
    const invoicesRef = collection(db, `customers/${currentCustomerId}/invoices`);
    const invoiceId = `${invoiceDate}_${invoiceNumber}`;
    await setDoc(doc(invoicesRef, invoiceId), {
      invoiceNumber: document.getElementById('invoiceNumber').value,
      date: document.getElementById('invoiceDate').value,
      businessName: document.getElementById('businessName').value,
      clientName: document.getElementById('clientName').value,
      pdfURL: downloadURL,
      createdAt: new Date(),
      grandTotal: parseFloat(document.getElementById('grandTotal').textContent)
    });
    
    showNotification('Invoice generated and saved successfully!');
    document.getElementById('invoiceModal').classList.add('hidden');
    loadInvoices();
    
  } catch (error) {
    console.error('Error generating invoice:', error);
    showNotification('Error generating invoice', 'error');
  } finally {
    showLoading(false);
  }
});

// Load invoices
async function loadInvoices() {
  try {
    const invoicesRef = collection(db, `customers/${currentCustomerId}/invoices`);
    const q = query(invoicesRef);
    const querySnapshot = await getDocs(q);
    
    const invoicesList = document.getElementById('invoicesList');
    const invoicesSection = document.getElementById('invoicesSection');
    
    if (querySnapshot.empty) {
      invoicesSection.classList.add('hidden');
      return;
    }
    
    invoicesList.innerHTML = '';
    querySnapshot.forEach((docSnap) => {
      const invoice = docSnap.data();
      const invoiceItem = document.createElement('div');
      invoiceItem.className = 'flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition';
      invoiceItem.innerHTML = `
        <div>
          <p class="font-semibold text-gray-900">${invoice.invoiceNumber}</p>
          <p class="text-sm text-gray-600">${invoice.date} - $${parseFloat(invoice.grandTotal).toFixed(2)}</p>
        </div>
        <a href="${invoice.pdfURL}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-semibold transition">
          Download
        </a>
      `;
      invoicesList.appendChild(invoiceItem);
    });
    
    invoicesSection.classList.remove('hidden');
  } catch (error) {
    console.error('Error loading invoices:', error);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  currentCustomerId = getCustomerIdFromURL();
  
  if (currentCustomerId) {
    loadCustomer(currentCustomerId);
  } else {
    showNotification('No customer ID provided', 'error');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);
  }
});
