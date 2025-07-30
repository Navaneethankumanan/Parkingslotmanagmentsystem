let tickets = JSON.parse(localStorage.getItem("tickets")) || [];
let archivedBatches = JSON.parse(localStorage.getItem("archivedBatches")) || [];
const BATCH_SIZE = 3;

let slots = {
  car: Array(100).fill(false),
  bike: Array(250).fill(false),
  heavy: Array(50).fill(false)
};

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  if (id === "history") loadHistory();
  if (id === "admin") loadAdminSummary();
  if (id === "qrscanner") startScanner();
}

window.onload = () => {
  const saved = JSON.parse(localStorage.getItem("parkingUser"));
  if (saved) {
    document.getElementById("navbar").style.display = "flex";
    document.getElementById("displayUser").innerText = saved.username;
    showPage("home");
    checkAvailability();
  } else {
    showPage("register");
  }
};

function logout() {
  localStorage.removeItem("parkingUser");
  document.getElementById("navbar").style.display = "none";
  showPage("login");
}

// 🟦 Register
document.getElementById("registerForm").addEventListener("submit", e => {
  e.preventDefault();
  const user = {
    username: document.getElementById("regUsername").value.trim(),
    email: document.getElementById("regEmail").value.trim(),
    password: document.getElementById("regPassword").value.trim()
  };
  localStorage.setItem("parkingUser", JSON.stringify(user));
  alert("Registered successfully! Please login.");
  showPage("login");
});

// 🟦 Login
document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const saved = JSON.parse(localStorage.getItem("parkingUser"));
  const uname = document.getElementById("loginUsername").value.trim();
  const pass = document.getElementById("loginPassword").value.trim();
  if (saved && uname === saved.username && pass === saved.password) {
    document.getElementById("navbar").style.display = "flex";
    document.getElementById("displayUser").innerText = saved.username;
    showPage("home");
    checkAvailability();
  } else {
    alert("Invalid credentials.");
  }
});

// 🟩 Entry Form
document.getElementById("entryForm").addEventListener("submit", e => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const vehicle = document.getElementById("vehiclenum").value.trim();
  const type = document.getElementById("vehicletype").value;

  if (!/^[A-Za-z\s]+$/.test(name)) return alert("Invalid name");
  if (!/^\d{10}$/.test(phone)) return alert("Invalid phone");

  const otp = Math.floor(1000 + Math.random() * 9000);
  const enteredOTP = prompt(`OTP: ${otp}\nEnter OTP:`);
  if (parseInt(enteredOTP) !== otp) return alert("OTP mismatch");

  const slotIndex = slots[type].indexOf(false);
  if (slotIndex === -1) return alert("No slots available");

  const rate = type === "car" ? 50 : type === "bike" ? 25 : 100;
  if (!confirm(`Initial charge ₹${rate}. Proceed?`)) return;

  const entryTime = Date.now();
  const ticketID = `TKT-${type}-${Date.now()}`;
  const newTicket = {
    id: ticketID, name, phone, vehicle, type, slot: slotIndex, entryTime, active: true
  };

  slots[type][slotIndex] = true;
  tickets.push(newTicket);
  localStorage.setItem("tickets", JSON.stringify(tickets));

  if (tickets.length > BATCH_SIZE) {
    const batch = tickets.splice(0, BATCH_SIZE);
    archivedBatches.push(batch);
    localStorage.setItem("archivedBatches", JSON.stringify(archivedBatches));
    localStorage.setItem("tickets", JSON.stringify(tickets));
  }

  document.getElementById("ticket").innerHTML = `
    <div class="ticket-box">
      <h3>🎟 Ticket Generated</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Vehicle:</strong> ${vehicle}</p>
      <p><strong>Type:</strong> ${type}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>ID:</strong> <span class="highlight">${ticketID}</span></p>
      <p><strong>Time:</strong> ${new Date(entryTime).toLocaleString()}</p>
      <canvas id="qrcode"></canvas>
    </div>
  `;
  QRCode.toCanvas(document.getElementById("qrcode"), ticketID, err => {
    if (err) console.error(err);
  });

  checkAvailability();
});

// 🔴 Exit Form
document.getElementById("exitForm").addEventListener("submit", e => {
  e.preventDefault();
  const ticketID = document.getElementById("ticketid").value.trim();
  const ticket = tickets.find(t => t.id === ticketID && t.active);
  if (!ticket) {
    document.getElementById("exitMsg").innerText = "❌ Invalid or already used Ticket ID.";
    return;
  }

  const duration = Math.ceil((Date.now() - ticket.entryTime) / 60000);
  const rate = ticket.type === "car" ? 50 : ticket.type === "bike" ? 25 : 100;
  const total = duration * rate;

  if (!confirm(`⏱ ${duration} min. Pay ₹${total}?`)) return;

  ticket.exitTime = Date.now();
  ticket.amount = total;
  ticket.active = false;
  slots[ticket.type][ticket.slot] = false;
  localStorage.setItem("tickets", JSON.stringify(tickets));

  document.getElementById("exitMsg").innerText = `✅ Exit for ${ticketID}. Paid ₹${total}`;
  checkAvailability();
});

// 📜 Load History (only latest batchSize)
function loadHistory() {
  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "";

  tickets.forEach(ticket => {
    const entryTime = new Date(ticket.entryTime).toLocaleString();
    const exitTime = ticket.exitTime ? new Date(ticket.exitTime).toLocaleString() : "Not Exited";
    const duration = ticket.exitTime ? Math.ceil((ticket.exitTime - ticket.entryTime) / 60000) : "--";
    const amount = ticket.amount ?? "--";
    const status = ticket.active ? "⏳ Active" : "✅ Exited";

    historyList.innerHTML += `
      <div class="ticket-box">
        <p><strong>ID:</strong> ${ticket.id}</p>
        <p><strong>Name:</strong> ${ticket.name}</p>
        <p><strong>Vehicle:</strong> ${ticket.vehicle}</p>
        <p><strong>Type:</strong> ${ticket.type}</p>
        <p><strong>Status:</strong> ${status}</p>
        <p><strong>Entry:</strong> ${entryTime}</p>
        <p><strong>Exit:</strong> ${exitTime}</p>
        <p><strong>Duration:</strong> ${duration} mins</p>
        <p><strong>Amount Paid:</strong> ₹${amount}</p>
      </div>
    `;
  });
}

function loadAdminSummary() {
  const adminSummary = document.getElementById("adminSummary");
  const totalRevenueBox = document.getElementById("totalRevenueBox");
  adminSummary.innerHTML = "";

  let archivedBatches = JSON.parse(localStorage.getItem("archivedBatches")) || [];
  let grandTotal = 0;

  archivedBatches.forEach((batch, index) => {
    let car = 0, bike = 0, heavy = 0;
    let carTime = 0, bikeTime = 0, heavyTime = 0;
    let carAmount = 0, bikeAmount = 0, heavyAmount = 0;

    let entryDates = [], exitDates = [];

    batch.forEach(ticket => {
      if (!ticket.entryTime || !ticket.exitTime) return;

      const duration = Math.ceil((ticket.exitTime - ticket.entryTime) / 60000);
      const rate = ticket.type === "car" ? 50 : ticket.type === "bike" ? 25 : 100;
      const amount = duration * rate;

      if (ticket.type === "car") {
        car++; carTime += duration; carAmount += amount;
      } else if (ticket.type === "bike") {
        bike++; bikeTime += duration; bikeAmount += amount;
      } else if (ticket.type === "heavy") {
        heavy++; heavyTime += duration; heavyAmount += amount;
      }

      entryDates.push(ticket.entryTime);
      exitDates.push(ticket.exitTime);
    });

    const fromDate = entryDates.length ? new Date(Math.min(...entryDates)).toLocaleString() : "N/A";
    const toDate = exitDates.length ? new Date(Math.max(...exitDates)).toLocaleString() : "N/A";
    const batchTotal = carAmount + bikeAmount + heavyAmount;
    grandTotal += batchTotal;

    adminSummary.innerHTML += `
      <div class="ticket-box">
        <h3>📦 Batch ${index + 1}</h3>
        <p><strong>Date:</strong> ${fromDate} to ${toDate}</p>
        <p>🚗 Cars: ${car} | Time: ${carTime} mins | ₹${carAmount}</p>
        <p>🏍 Bikes: ${bike} | Time: ${bikeTime} mins | ₹${bikeAmount}</p>
        <p>🚚 Heavy: ${heavy} | Time: ${heavyTime} mins | ₹${heavyAmount}</p>
        <p><strong>Total Revenue:</strong> ₹${batchTotal}</p>
      </div>
    `;
  });

  document.getElementById("totalRevenueBox").innerText = `₹${grandTotal}`;
document.getElementById("adminTotalRevenue").innerText = `💰 Total Overall Revenue: ₹${grandTotal}`;

}

// 🧹 Reset Admin + History (only once manually)
function clearAllBatchesAndHistory() {
  localStorage.removeItem("archivedBatches");
  localStorage.removeItem("tickets");
  archivedBatches = [];
  tickets = [];
  alert("Admin panel and history cleared!");
  showPage("admin");
}

// ✅ Availability
function checkAvailability() {
  const car = slots.car.filter(v => !v).length;
  const bike = slots.bike.filter(v => !v).length;
  const heavy = slots.heavy.filter(v => !v).length;
  document.getElementById("slots-result").innerHTML = `
    <p>🚗 Car Slots: ${car}</p>
    <p>🏍 Bike Slots: ${bike}</p>
    <p>🚚 Heavy Slots: ${heavy}</p>
  `;
}

function toggleSlots() {
  const slotsDiv = document.getElementById("slots-result");
  const btn = document.getElementById("toggleSlotsBtn");

  if (slotsDiv.style.display === "none" || slotsDiv.style.display === "") {
    checkAvailability();
    slotsDiv.style.display = "block";
    btn.innerText = "Hide Slots";
  } else {
    slotsDiv.style.display = "none";
    btn.innerText = "Show Available Slots";
  }
}

// 📷 QR Scanner
function startScanner() {
  let scanner = new Instascan.Scanner({ video: document.getElementById('preview') });
  scanner.addListener('scan', content => {
    const ticket = tickets.find(t => t.id === content.trim());
    if (ticket) {
      document.getElementById("scanResult").innerText = `🎫 Valid Ticket: ${ticket.id} (${ticket.active ? "Active" : "Exited"})`;
    } else {
      document.getElementById("scanResult").innerText = "❌ Invalid Ticket";
    }
  });

  Instascan.Camera.getCameras().then(cameras => {
    if (cameras.length > 0) {
      scanner.start(cameras[0]);
    } else {
      alert("No camera found");
    }
  }).catch(err => console.error(err));
}
function clearAdminAndHistory() {
  localStorage.removeItem("tickets");           // clears current history
  localStorage.removeItem("archivedBatches");   // clears admin batches
  alert("🧹 History and Admin panel have been cleared!");
}






/*   let tickets = [];
  let batchHistory = JSON.parse(localStorage.getItem("batchHistory")) || [];
  const BATCH_SIZE = 3; // Change to 50 later for production



  let slots = {
    car: Array(100).fill(false),
    bike: Array(250).fill(false),
    heavy: Array(50).fill(false)
  };

  function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    if (id === "history") loadHistory();
    if (id === "admin") {
      loadAdminSummary(); // existing
      loadAdminBatches(); // new
    }
    
  }

  window.onload = () => {
    const saved = JSON.parse(localStorage.getItem("parkingUser"));
    if (!localStorage.getItem("archivedBatches")) {
      localStorage.setItem("archivedBatches", JSON.stringify([]));
    }
    
    if (saved) {
      document.getElementById("navbar").style.display = "flex";
      document.getElementById("displayUser").innerText = saved.username;
      showPage("home");
      checkAvailability();
      const storedTickets = JSON.parse(localStorage.getItem("tickets"));
      if (storedTickets) tickets = storedTickets;
    } else {
      showPage("register");
    }
  };

  function logout() {
    localStorage.removeItem("parkingUser");
    document.getElementById("navbar").style.display = "none";
    showPage("login");
  }

  document.getElementById("registerForm").addEventListener("submit", e => {
    e.preventDefault();
    const user = {
      username: document.getElementById("regUsername").value.trim(),
      email: document.getElementById("regEmail").value.trim(),
      password: document.getElementById("regPassword").value.trim()
    };
    localStorage.setItem("parkingUser", JSON.stringify(user));
    alert("Registered successfully! Please login.");
    showPage("login");
  });

  document.getElementById("loginForm").addEventListener("submit", e => {
    e.preventDefault();
    const saved = JSON.parse(localStorage.getItem("parkingUser"));
    const uname = document.getElementById("loginUsername").value.trim();
    const pass = document.getElementById("loginPassword").value.trim();
    if (saved && uname === saved.username && pass === saved.password) {
      document.getElementById("navbar").style.display = "flex";
      document.getElementById("displayUser").innerText = saved.username;
      showPage("home");
      checkAvailability();
    } else {
      alert("Invalid credentials.");
    }
  });

  document.getElementById("entryForm").addEventListener("submit", e => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const vehicle = document.getElementById("vehiclenum").value.trim();
    const type = document.getElementById("vehicletype").value;

    if (!/^[A-Za-z\s]+$/.test(name)) return alert("Invalid name");
    if (!/^\d{10}$/.test(phone)) return alert("Invalid phone");

    const otp = Math.floor(1000 + Math.random() * 9000);
    const enteredOTP = prompt(`OTP: ${otp}\nEnter OTP:`);
    if (parseInt(enteredOTP) !== otp) return alert("OTP mismatch");

    const slotIndex = slots[type].indexOf(false);
    if (slotIndex === -1) return alert("No slots available");

    const rate = type === "car" ? 50 : type === "bike" ? 25 : 100;
    if (!confirm(`Initial charge ₹${rate}. Proceed?`)) return;

    const entryTime = Date.now();
    const ticketID = `TKT-${type}-${tickets.length + 1}`;
    const newTicket = {
      id: ticketID, name, phone, vehicle, type, slot: slotIndex, entryTime, active: true
    };

    slots[type][slotIndex] = true;
    tickets.push(newTicket);
    localStorage.setItem("tickets", JSON.stringify(tickets));
    if (tickets.length >= BATCH_SIZE) {
      saveBatch();
    }

    document.getElementById("ticket").innerHTML = `
      <div class="ticket-box">
        <h3>🎟 Ticket Generated</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Vehicle:</strong> ${vehicle}</p>
        <p><strong>Type:</strong> ${type}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>ID:</strong> <span class="highlight">${ticketID}</span></p>
        <p><strong>Time:</strong> ${new Date(entryTime).toLocaleString()}</p>
        <canvas id="qrcode"></canvas>
      </div>
    `;
    QRCode.toCanvas(document.getElementById("qrcode"), ticketID, err => {
      if (err) console.error(err);
    });

    checkAvailability();
  });

  document.getElementById("exitForm").addEventListener("submit", e => {
    e.preventDefault();
    const ticketID = document.getElementById("ticketid").value.trim();
    const ticket = tickets.find(t => t.id === ticketID && t.active);
    if (!ticket) {
      document.getElementById("exitMsg").innerText = "❌ Invalid or already used Ticket ID.";
      return;
    }

    const duration = Math.ceil((Date.now() - ticket.entryTime) / 60000);
    const rate = ticket.type === "car" ? 50 : ticket.type === "bike" ? 25 : 100;
    const total = duration * rate;

    if (!confirm(`⏱ ${duration} min. Pay ₹${total}?`)) return;

    ticket.exitTime = Date.now();
    ticket.amount = total;
    ticket.active = false;
    slots[ticket.type][ticket.slot] = false;
    localStorage.setItem("tickets", JSON.stringify(tickets));

    document.getElementById("exitMsg").innerText = `✅ Exit for ${ticketID}. Paid ₹${total}`;
    checkAvailability();
  });
  // 📦 Split Tickets into Batches and Store
  function storeTicketBatch() {
    const batchSize = 50;
    let allTickets = JSON.parse(localStorage.getItem("tickets")) || [];
    let ticketBatches = JSON.parse(localStorage.getItem("ticketBatches")) || [];

    while (allTickets.length >= batchSize) {
      const batch = allTickets.splice(0, batchSize);
      const batchInfo = {
        id: ticketBatches.length + 1,
        startDate: new Date(batch[0].entryTime).toLocaleString(),
        endDate: batch[batch.length - 1].exitTime
          ? new Date(batch[batch.length - 1].exitTime).toLocaleString()
          : "Ongoing",
        tickets: batch
      };
      ticketBatches.push(batchInfo);
    }

    localStorage.setItem("ticketBatches", JSON.stringify(ticketBatches));
    localStorage.setItem("tickets", JSON.stringify(allTickets));
  }

  // ✅ Call after exit
  // Add this inside your existing `exitForm` submission (just after updating ticket data)
  storeTicketBatch();

  function loadAdminBatches() {
    const batchHistory = JSON.parse(localStorage.getItem("batchHistory")) || [];
    const container = document.getElementById("adminSummary");
    container.innerHTML = ""; // clear existing

    if (batchHistory.length === 0) {
      container.innerHTML = `<div class="ticket-box"><h3>📊 Admin Dashboard</h3><p>No batch data available.</p></div>`;
      document.getElementById("totalRevenueBox").innerText = `₹0`;
      return;
    }

    let overallRevenue = 0;

    batchHistory.forEach((batch, index) => {
      let typeCounts = { car: 0, bike: 0, heavy: 0 };
      let typeDurations = { car: 0, bike: 0, heavy: 0 };
      let typeRevenues = { car: 0, bike: 0, heavy: 0 };

      let entryTimes = batch.map(t => t.entryTime);
      let exitTimes = batch.map(t => t.exitTime || Date.now());

      batch.forEach(ticket => {
        const mins = Math.ceil((ticket.exitTime - ticket.entryTime) / 60000);
        const rate = ticket.type === "car" ? 50 : ticket.type === "bike" ? 25 : 100;
        const revenue = mins * rate;

        typeCounts[ticket.type]++;
        typeDurations[ticket.type] += mins;
        typeRevenues[ticket.type] += revenue;

        overallRevenue += revenue;
      });

      const entryDate = new Date(Math.min(...entryTimes)).toLocaleString();
      const exitDate = new Date(Math.max(...exitTimes)).toLocaleString();

      container.innerHTML += `
        <div class="ticket-box">
          <h3>📦 Batch #${index + 1}</h3>
          <p><strong>📅 Entry:</strong> ${entryDate}</p>
          <p><strong>📅 Exit:</strong> ${exitDate}</p>
          <p>🚗 Car Count: ${typeCounts.car}, Time: ${typeDurations.car} min, Revenue: ₹${typeRevenues.car}</p>
          <p>🏍 Bike Count: ${typeCounts.bike}, Time: ${typeDurations.bike} min, Revenue: ₹${typeRevenues.bike}</p>
          <p>🚚 Heavy Count: ${typeCounts.heavy}, Time: ${typeDurations.heavy} min, Revenue: ₹${typeRevenues.heavy}</p>
          <p><strong>💰 Batch Total Revenue:</strong> ₹${typeRevenues.car + typeRevenues.bike + typeRevenues.heavy}</p>
        </div>
      `;
    });

    document.getElementById("totalRevenueBox").innerText = `₹${overallRevenue}`;
  }

  function saveBatch() {
    let archivedBatches = JSON.parse(localStorage.getItem("archivedBatches")) || [];
    const batch = tickets.splice(0, BATCH_SIZE);  // Remove first BATCH_SIZE
    archivedBatches.push(batch);
    localStorage.setItem("archivedBatches", JSON.stringify(archivedBatches));
    localStorage.setItem("tickets", JSON.stringify(tickets));
  }
  
  


  function loadHistory() {
    const historyList = document.getElementById("historyList");
    historyList.innerHTML = "";
  
    tickets.forEach(ticket => {
      const entryTime = new Date(ticket.entryTime).toLocaleString();
      const exitTime = ticket.exitTime ? new Date(ticket.exitTime).toLocaleString() : null;
      const duration = ticket.exitTime ? Math.ceil((ticket.exitTime - ticket.entryTime) / 60000) : null;
      const rate = ticket.type === "car" ? 50 : ticket.type === "bike" ? 25 : 100;
      const amount = ticket.amount ?? (duration ? duration * rate : null);
      const isExited = ticket.exitTime || ticket.active === false;
  
      const statusHTML = isExited
        ? `<p><strong>Status:</strong> ✅ Exited</p>
          <p><strong>Exited at:</strong> ${exitTime}</p>
          <p><strong>Duration:</strong> ${duration} minute(s)</p>
          <p><strong>Amount Paid:</strong> ₹${amount}</p>`
        : `<p><strong>Status:</strong> ⏳ Active</p>`;
  
      historyList.innerHTML += `
        <div class="ticket-box">
          <p><strong>ID:</strong> ${ticket.id}</p>
          <p><strong>Name:</strong> ${ticket.name}</p>
          <p><strong>Vehicle:</strong> ${ticket.vehicle}</p>
          <p><strong>Type:</strong> ${ticket.type}</p>
          <p><strong>Entry:</strong> ${entryTime}</p>
          ${statusHTML}
        </div>
      `;
    });
  }
  


  function showSlots() {
    checkAvailability(); // existing function
    document.getElementById("slots-result").style.display = "block";
  }


  function checkAvailability() {
    const car = slots.car.filter(v => !v).length;
    const bike = slots.bike.filter(v => !v).length;
    const heavy = slots.heavy.filter(v => !v).length;
    document.getElementById("slots-result").innerHTML = `
      <p>🚗 Car Slots: ${car}</p>
      <p>🏍 Bike Slots: ${bike}</p>
      <p>🚚 Heavy Slots: ${heavy}</p>
    `;
  }
  function toggleSlots() {
    const slotsDiv = document.getElementById("slots-result");
    const btn = document.getElementById("toggleSlotsBtn");

    if (slotsDiv.style.display === "none" || slotsDiv.style.display === "") {
      checkAvailability();
      slotsDiv.style.display = "block";
      btn.innerText = "Hide Slots";
    } else {
      slotsDiv.style.display = "none";
      btn.innerText = "Show Available Slots";
    }
  }

  function loadAdminSummary() {
    const adminSummary = document.getElementById("adminSummary");
    const totalRevenueBox = document.getElementById("totalRevenueBox");
    adminSummary.innerHTML = "";
  
    let archivedBatches = JSON.parse(localStorage.getItem("archivedBatches")) || [];
    let grandTotal = 0;
  
    archivedBatches.forEach((batch, index) => {
      let car = 0, bike = 0, heavy = 0;
      let carTime = 0, bikeTime = 0, heavyTime = 0;
      let carAmount = 0, bikeAmount = 0, heavyAmount = 0;
      let entryTimes = [], exitTimes = [];
  
      batch.forEach(ticket => {
        if (!ticket.entryTime || !ticket.exitTime) return;
  
        const duration = Math.ceil((ticket.exitTime - ticket.entryTime) / 60000);
        const amount = ticket.amount ?? duration * (
          ticket.type === "car" ? 50 :
          ticket.type === "bike" ? 25 : 100
        );
  
        if (ticket.type === "car") {
          car++; carTime += duration; carAmount += amount;
        } else if (ticket.type === "bike") {
          bike++; bikeTime += duration; bikeAmount += amount;
        } else if (ticket.type === "heavy") {
          heavy++; heavyTime += duration; heavyAmount += amount;
        }
  
        entryTimes.push(ticket.entryTime);
        exitTimes.push(ticket.exitTime);
      });
  
      const fromDate = entryTimes.length ? new Date(Math.min(...entryTimes)).toLocaleString() : "--";
      const toDate = exitTimes.length ? new Date(Math.max(...exitTimes)).toLocaleString() : "--";
  
      const batchTotal = carAmount + bikeAmount + heavyAmount;
      grandTotal += batchTotal;
  
      adminSummary.innerHTML += `
        <div class="ticket-box">
          <h3>📦 Batch ${index + 1}</h3>
          <p><strong>Date:</strong> ${fromDate} to ${toDate}</p>
          <p>🚗 Cars: ${car} | Time: ${carTime} mins | ₹${carAmount}</p>
          <p>🏍 Bikes: ${bike} | Time: ${bikeTime} mins | ₹${bikeAmount}</p>
          <p>🚚 Heavy: ${heavy} | Time: ${heavyTime} mins | ₹${heavyAmount}</p>
          <p><strong>Total Revenue:</strong> ₹${batchTotal}</p>
        </div>
      `;
    });
  
    totalRevenueBox.innerText = `₹${grandTotal}`;
  }
  
  






  // 📷 QR Scanner Handler
  function startScanner() {
    let scanner = new Instascan.Scanner({ video: document.getElementById('preview') });
    scanner.addListener('scan', content => {
      const ticket = tickets.find(t => t.id === content.trim());
      if (ticket) {
        document.getElementById("scanResult").innerText = `🎫 Valid Ticket: ${ticket.id} (${ticket.active ? "Active" : "Exited"})`;
      } else {
        document.getElementById("scanResult").innerText = "❌ Invalid Ticket";
      }
    });

    Instascan.Camera.getCameras().then(cameras => {
      if (cameras.length > 0) {
        scanner.start(cameras[0]);
      } else {
        alert("No camera found");
      }
    }).catch(err => console.error(err));
  }

  // 🧭 Modified showPage function to include new sections
  function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    
    
    if (id === "history") loadHistory();
    if (id === "qrscanner") startScanner();
    if (id === "admin") loadAdminSummary();
  }
  function clearAdminAndHistory() {
    localStorage.removeItem("tickets");           // clears current history
    localStorage.removeItem("archivedBatches");   // clears admin batches
    alert("🧹 History and Admin panel have been cleared!");
  }
   */