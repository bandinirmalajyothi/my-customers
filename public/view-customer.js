import { db, storage } from './firebase-config.js';
import { doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

let currentCustomerId = null;
let currentCustomer = null;
let photoFile = null;

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
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('File size must be less than 5MB', 'error');
      return;
    }
    
    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showNotification('Only JPG, PNG, and WebP files are allowed', 'error');
      return;
    }
    
    photoFile = file;
    
    // Show preview
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
    
    // Upload photo if a new one was selected
    if (photoFile) {
      const photoURL = await uploadPhoto();
      formData.photoURL = photoURL;
      photoFile = null; // Reset after upload
      document.getElementById('photoInput').value = ''; // Clear input
    }
    
    // Update Firestore
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

// Invoice button handler (placeholder)
document.getElementById('invoiceBtn').addEventListener('click', (e) => {
  e.preventDefault();
  showNotification('Invoice generation coming soon!');
});

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
