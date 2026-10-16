const API_BASE_URL = "http://127.0.0.1:8000";

const elements = {
  apiStatus: document.getElementById("api-status"),
  apiMessage: document.getElementById("api-message"),
  djangoStatus: document.getElementById("django-status"),
  restStatus: document.getElementById("rest-status"),
  netmikoStatus: document.getElementById("netmiko-status"),
  sidebarStatus: document.getElementById("sidebar-status"),
  lastUpdated: document.getElementById("last-updated"),
  refreshButton: document.getElementById("refresh-btn"),
  
  // Các thẻ hiển thị số liệu
  totalDevices: document.getElementById("total-devices"),
  onlineDevices: document.getElementById("online-devices"),
  totalVlans: document.getElementById("total-vlans"),
  devicesPanel: document.getElementById("devices"),
  vlansPanel: document.getElementById("vlans"),
  
  // Modal & Form Tạo VLAN
  vlanForm: document.getElementById("create-vlan-form"),
  vlanDeviceSelect: document.getElementById("vlan-device-select"),
  btnSubmitVlan: document.getElementById("btn-submit-vlan"),
  
  // Modal & Form Gán Port
  portForm: document.getElementById("assign-port-form"),
  portDeviceSelect: document.getElementById("port-device-select"),
  btnSubmitPort: document.getElementById("btn-submit-port"),
};

// Đọc danh sách Port đã gán từ localStorage (nếu có) để không bị mất khi Refresh trang
let portAssignments = JSON.parse(localStorage.getItem("portAssignments")) || [];

// 1. Kiểm tra trạng thái Backend
async function checkBackend() {
  elements.apiStatus.textContent = "...";
  elements.apiMessage.textContent = "Đang kết nối máy chủ";

  try {
    const response = await fetch(`${API_BASE_URL}/api/status/`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.success !== true) throw new Error("Trạng thái không hợp lệ");

    elements.apiStatus.textContent = "Online";
    elements.apiMessage.textContent = "Kết nối thành công";
    elements.djangoStatus.textContent = "Hoạt động";
    elements.djangoStatus.style.color = "#15945c";
    elements.restStatus.textContent = "Hoạt động";
    elements.netmikoStatus.textContent = data.network_automation;
    elements.sidebarStatus.textContent = "Backend đang hoạt động";
    elements.lastUpdated.textContent = new Date().toLocaleTimeString("vi-VN");

    document.querySelector(".status-dot").style.background = "#20c997";
  } catch (error) {
    console.error("Lỗi kết nối backend:", error);

    elements.apiStatus.textContent = "Offline";
    elements.apiMessage.textContent = "Không thể kết nối API";
    elements.djangoStatus.textContent = "Không kết nối";
    elements.djangoStatus.style.color = "#dc3545";
    elements.restStatus.textContent = "Không khả dụng";
    elements.netmikoStatus.textContent = "Chưa xác minh";
    elements.sidebarStatus.textContent = "Backend không khả dụng";

    document.querySelector(".status-dot").style.background = "#dc3545";
  }
}

// 2. Lấy số liệu thống kê (Thẻ Tổng thiết bị, Trực tuyến, VLAN)
async function fetchStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stats/`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return;

    const data = await response.json();
    if (elements.totalDevices) elements.totalDevices.textContent = data.total_devices ?? 0;
    if (elements.onlineDevices) elements.onlineDevices.textContent = data.online_devices ?? 0;
    if (elements.totalVlans) elements.totalVlans.textContent = data.total_vlans ?? 0;
  } catch (error) {
    console.error("Lỗi lấy dữ liệu stats:", error);
  }
}

// 3. Lấy danh sách thiết bị
async function fetchDevices() {
  if (!elements.devicesPanel) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/devices/`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return;

    const data = await response.json();
    const devices = data.devices || [];
    const emptyState = elements.devicesPanel.querySelector(".empty-state");

    updateDeviceSelectOptions(devices);

    if (devices.length > 0) {
      if (emptyState) emptyState.style.display = "none";

      let tableHtml = `
        <div class="table-responsive mt-3">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Hostname</th>
                <th>IP Address</th>
                <th>Loại thiết bị</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
      `;

      devices.forEach((dev) => {
        const badge = dev.is_online
          ? '<span class="badge bg-success">Online</span>'
          : '<span class="badge bg-secondary">Offline</span>';

        tableHtml += `
          <tr>
            <td><strong>${dev.hostname}</strong></td>
            <td><code>${dev.ip_address}</code></td>
            <td>${dev.device_type}</td>
            <td>${badge}</td>
          </tr>
        `;
      });

      tableHtml += `
            </tbody>
          </table>
        </div>
      `;

      const oldTable = elements.devicesPanel.querySelector(".table-responsive");
      if (oldTable) oldTable.remove();
      elements.devicesPanel.insertAdjacentHTML("beforeend", tableHtml);
    } else {
      if (emptyState) emptyState.style.display = "block";
      const oldTable = elements.devicesPanel.querySelector(".table-responsive");
      if (oldTable) oldTable.remove();
    }
  } catch (error) {
    console.error("Lỗi lấy danh sách thiết bị:", error);
  }
}

// Cập nhật danh sách Option trong các Modal Chọn Thiết bị
function updateDeviceSelectOptions(devices) {
  let optionsHtml = "";
  if (devices.length === 0) {
    optionsHtml = `<option value="">Chưa có thiết bị nào</option>`;
  } else {
    devices.forEach((dev) => {
      optionsHtml += `<option value="${dev.id}">${dev.hostname} (${dev.ip_address})</option>`;
    });
  }

  if (elements.vlanDeviceSelect) {
    elements.vlanDeviceSelect.innerHTML = optionsHtml;
  }
  if (elements.portDeviceSelect) {
    elements.portDeviceSelect.innerHTML = optionsHtml;
  }
}

// Hiển thị danh sách Port đã gán lên giao diện
function renderPortTable() {
  const portLogContainer = document.getElementById("port-log");
  if (!portLogContainer) return;

  if (portAssignments.length === 0) {
    portLogContainer.style.display = "block";
    portLogContainer.innerHTML = "Chưa có thao tác gán Port nào được ghi nhận.";
    const oldTable = document.getElementById("ports")?.querySelector(".table-responsive");
    if (oldTable) oldTable.remove();
    return;
  }

  portLogContainer.style.display = "none";

  let tableHtml = `
    <div class="table-responsive mt-3">
      <table class="table table-hover align-middle mb-0">
        <thead>
          <tr>
            <th>Tên Port</th>
            <th>VLAN ID</th>
            <th>Thiết bị</th>
            <th>Thời gian thực hiện</th>
          </tr>
        </thead>
        <tbody>
  `;

  portAssignments.forEach((item) => {
    tableHtml += `
      <tr>
        <td><code>${item.portName}</code></td>
        <td><span class="badge bg-success">VLAN ${item.vlanId}</span></td>
        <td>${item.deviceName}</td>
        <td><small class="text-muted">${item.timestamp}</small></td>
      </tr>
    `;
  });

  tableHtml += `
        </tbody>
      </table>
    </div>
  `;

  const oldTable = document.getElementById("ports")?.querySelector(".table-responsive");
  if (oldTable) oldTable.remove();
  document.getElementById("ports")?.insertAdjacentHTML("beforeend", tableHtml);
}

// 4. Lấy danh sách VLAN và hiển thị trên giao diện
async function fetchVlans() {
  if (!elements.vlansPanel) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/vlans/`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return;

    const data = await response.json();
    const vlans = data.vlans || [];
    const activityLog = document.getElementById("activity-log");

    if (vlans.length > 0) {
      if (activityLog) activityLog.style.display = "none";

      let tableHtml = `
        <div class="table-responsive mt-3">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>VLAN ID</th>
                <th>Tên VLAN</th>
                <th>Thiết bị sở hữu</th>
              </tr>
            </thead>
            <tbody>
      `;

      vlans.forEach((v) => {
        tableHtml += `
          <tr>
            <td><span class="badge bg-primary">VLAN ${v.vlan_id}</span></td>
            <td><strong>${v.name}</strong></td>
            <td>${v.device__hostname} (<code>${v.device__ip_address}</code>)</td>
          </tr>
        `;
      });

      tableHtml += `
            </tbody>
          </table>
        </div>
      `;

      const oldTable = elements.vlansPanel.querySelector(".table-responsive");
      if (oldTable) oldTable.remove();
      elements.vlansPanel.insertAdjacentHTML("beforeend", tableHtml);
    } else {
      if (activityLog) activityLog.style.display = "block";
      const oldTable = elements.vlansPanel.querySelector(".table-responsive");
      if (oldTable) oldTable.remove();
    }
  } catch (error) {
    console.error("Lỗi lấy danh sách VLAN:", error);
  }
}

// 5. Xử lý gửi lệnh Tạo VLAN via SSH
if (elements.vlanForm) {
  elements.vlanForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const deviceId = elements.vlanDeviceSelect.value;
    const vlanId = document.getElementById("vlan-id-input").value;
    const vlanName = document.getElementById("vlan-name-input").value;

    if (!deviceId) {
      alert("Vui lòng chọn một thiết bị!");
      return;
    }

    elements.btnSubmitVlan.disabled = true;
    elements.btnSubmitVlan.innerText = "Đang đẩy lệnh SSH...";

    try {
      const response = await fetch(`${API_BASE_URL}/api/vlans/create/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: parseInt(deviceId),
          vlan_id: parseInt(vlanId),
          vlan_name: vlanName,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`Thành công: ${data.message}`);
        elements.vlanForm.reset();

        const modalEl = document.getElementById("createVlanModal");
        if (modalEl && typeof bootstrap !== "undefined") {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }

        refreshAllData();
      } else {
        alert(`Lỗi: ${data.error || "Không thể đẩy lệnh SSH tạo VLAN"}`);
      }
    } catch (error) {
      console.error("Lỗi gửi lệnh tạo VLAN:", error);
      alert("Không thể kết nối đến máy chủ Backend!");
    } finally {
      elements.btnSubmitVlan.disabled = false;
      elements.btnSubmitVlan.innerText = "Gửi lệnh SSH tạo VLAN";
    }
  });
}

// 6. Xử lý gửi lệnh Gán Port vào VLAN via SSH
if (elements.portForm) {
  elements.portForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const deviceId = elements.portDeviceSelect.value;
    const portName = document.getElementById("port-name-input").value;
    const vlanId = document.getElementById("port-vlan-id-input").value;

    if (!deviceId) {
      alert("Vui lòng chọn một thiết bị!");
      return;
    }

    elements.btnSubmitPort.disabled = true;
    elements.btnSubmitPort.innerText = "Đang đẩy lệnh SSH...";

    try {
      const response = await fetch(`${API_BASE_URL}/api/ports/assign/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: parseInt(deviceId),
          port_name: portName,
          vlan_id: parseInt(vlanId),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`Thành công: ${data.message || "Đã gán Port vào VLAN thành công!"}`);

        // Ghi nhận thông tin vừa gán vào mảng
        const deviceText = elements.portDeviceSelect.options[elements.portDeviceSelect.selectedIndex]?.text || "Device";
        portAssignments.unshift({
          portName: portName,
          vlanId: vlanId,
          deviceName: deviceText,
          timestamp: new Date().toLocaleTimeString("vi-VN"),
        });

        // Lưu danh sách vào localStorage
        localStorage.setItem("portAssignments", JSON.stringify(portAssignments));

        // Cập nhật lại bảng trên màn hình
        renderPortTable();

        elements.portForm.reset();

        const modalEl = document.getElementById("assignPortModal");
        if (modalEl && typeof bootstrap !== "undefined") {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }

        refreshAllData();
      } else {
        alert(`Lỗi: ${data.error || "Không thể đẩy lệnh SSH gán Port"}`);
      }
    } catch (error) {
      console.error("Lỗi gửi lệnh gán port:", error);
      alert("Không thể kết nối đến máy chủ Backend!");
    } finally {
      elements.btnSubmitPort.disabled = false;
      elements.btnSubmitPort.innerText = "Gửi lệnh SSH gán Port";
    }
  });
}

// Hàm tổng hợp gọi toàn bộ API
async function refreshAllData() {
  elements.refreshButton.disabled = true;
  await Promise.all([
    checkBackend(),
    fetchStats(),
    fetchDevices(),
    fetchVlans()
  ]);
  renderPortTable();
  elements.refreshButton.disabled = false;
}

// Lắng nghe sự kiện click nút Refresh
elements.refreshButton.addEventListener("click", refreshAllData);

// Tải dữ liệu ban đầu khi load trang
refreshAllData();