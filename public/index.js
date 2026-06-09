import { db, storage } from './firebase-config.js';
import { collection, getDocs, query, where, updateDoc, doc, deleteDoc, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let customers = [];

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

// Load customers from Firestore
async function loadCustomers() {
  showLoading(true);
  try {
    const q = query(collection(db, 'customers'), where('status', '!=', 'Complete'));
    const querySnapshot = await getDocs(q);
    customers = [];
    
    querySnapshot.forEach((doc) => {
      customers.push({ id: doc.id, ...doc.data() });
    });

    renderKanban();
  } catch (error) {
    console.error('Error loading customers:', error);
    showNotification('Error loading customers', 'error');
  } finally {
    showLoading(false);
  }
}

// Render Kanban board
function renderKanban() {
  const columns = ['Planning', 'In-progress', 'Review'];
  
  columns.forEach(status => {
    const column = document.getElementById(`${status.toLowerCase().replace('-', '-')}-column`);
    if (!column) return;
    
    column.innerHTML = '';
    
    const statusCustomers = customers.filter(c => c.status === status);
    
    statusCustomers.forEach(customer => {
      const card = createCustomerCard(customer);
      column.appendChild(card);
    });
  });
}

// Create a customer card
function createCustomerCard(customer) {
  const card = document.createElement('div');
  card.draggable = true;
  card.className = 'bg-white rounded-lg p-4 shadow hover:shadow-md transition cursor-grab active:cursor-grabbing';
  card.dataset.customerId = customer.id;
  
  const photoHTML = customer.photoURL ? `<img src="${customer.photoURL}" alt="${customer.name}" class="w-full h-32 object-cover rounded mb-3">` : `<div class="w-full h-32 bg-gray-300 rounded mb-3 flex items-center justify-center"><span class="text-gray-500">No photo</span></div>`;
  
  card.innerHTML = `
    ${photoHTML}
    <h3 class="font-bold text-gray-900 mb-2">${customer.name}</h3>
    <p class="text-sm text-gray-600 mb-3">Balance: $${parseFloat(customer.balance || 0).toFixed(2)}</p>
    <button class="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded transition" onclick="viewCustomer('${customer.id}')">
      Edit Details
    </button>
  `;
  
  card.addEventListener('dragstart', handleDragStart);
  card.addEventListener('dragend', handleDragEnd);
  
  return card;
}

// Drag and drop handlers
let draggedElement = null;

function handleDragStart(e) {
  draggedElement = this;
  this.classList.add('opacity-50');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  this.classList.remove('opacity-50');
  draggedElement = null;
}

// Setup kanban columns for drop
function setupDropZones() {
  const columns = document.querySelectorAll('.kanban-column');
  
  columns.forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      column.classList.add('bg-blue-100');
    });
    
    column.addEventListener('dragleave', (e) => {
      column.classList.remove('bg-blue-100');
    });
    
    column.addEventListener('drop', async (e) => {
      e.preventDefault();
      column.classList.remove('bg-blue-100');
      
      if (draggedElement) {
        const customerId = draggedElement.dataset.customerId;
        const newStatus = column.dataset.status;
        
        // Update in Firestore
        try {
          const customerRef = doc(db, 'customers', customerId);
          await updateDoc(customerRef, { status: newStatus });
          
          // Update local state
          const customer = customers.find(c => c.id === customerId);
          if (customer) {
            customer.status = newStatus;
          }
          
          renderKanban();
          showNotification(`Customer moved to ${newStatus}`);
        } catch (error) {
          console.error('Error updating customer status:', error);
          showNotification('Error updating customer', 'error');
        }
      }
    });
  });
}

// View customer details
function viewCustomer(customerId) {
  window.location.href = `view-customer.html?id=${customerId}`;
}

// Make viewCustomer available globally
window.viewCustomer = viewCustomer;

// Add customer button handler
document.getElementById('addCustomerBtn').addEventListener('click', async () => {
  try {
    const newCustomer = {
      name: 'New Customer',
      status: 'Planning',
      balance: 0,
      notes: '',
      photoURL: ''
    };
    
    const docRef = await addDoc(collection(db, 'customers'), newCustomer);
    showNotification('Customer created! Redirecting to details...');
    
    setTimeout(() => {
      viewCustomer(docRef.id);
    }, 500);
  } catch (error) {
    console.error('Error creating customer:', error);
    showNotification('Error creating customer', 'error');
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupDropZones();
  loadCustomers();
});
