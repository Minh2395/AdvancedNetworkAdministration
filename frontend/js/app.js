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
  
  totalDevices: document.getElementById("total-devices"),
  onlineDevices: document.getElementById("online-devices"),
  totalVlans: document.getElementById("total-vlans"),
  devicesPanel: document.getElementById("devices"),
  vlansPanel: document.getElementById("vlans"),
  
  vlanForm: document.getElementById("create-vlan-form"),
  vlanDeviceSelect: document.getElementById("vlan-device-select"),
  btnSubmitVlan: document.getElementById("btn-submit-vlan"),
  
  portForm: document.getElementById("assign-port-form"),
  portDeviceSelect: document.getElementById("port-device-select"),
  btnSubmitPort: document.getElementById("btn-submit-port"),
};

let portAssignments = JSON.parse(localStorage.getItem("portAssignments")) || [];
let networkInstance = null;
let isInitialTopologyLoaded = false;

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
                <th class="text-end">Thao tác</th>
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
            <td class="text-end">
              <button class="btn btn-outline-danger btn-sm" onclick="deleteDevice(${dev.id})">Xóa</button>
            </td>
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
            <th class="text-end">Thao tác</th>
          </tr>
        </thead>
        <tbody>
  `;

  portAssignments.forEach((item, index) => {
    tableHtml += `
      <tr>
        <td><code>${item.portName}</code></td>
        <td><span class="badge bg-success">VLAN ${item.vlanId}</span></td>
        <td>${item.deviceName}</td>
        <td><small class="text-muted">${item.timestamp}</small></td>
        <td class="text-end">
          <button class="btn btn-outline-danger btn-sm" onclick="deletePort(${index})">Xóa</button>
        </td>
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
                <th class="text-end">Thao tác</th>
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
            <td class="text-end">
              <button class="btn btn-outline-danger btn-sm" onclick="deleteVlan(${v.id})">Xóa</button>
            </td>
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

// Xử lý gửi form Thêm thiết bị mạng mới
const addDeviceForm = document.getElementById("add-device-form");
if (addDeviceForm) {
  addDeviceForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const hostname = document.getElementById("device-hostname-input").value;
    const ipAddress = document.getElementById("device-ip-input").value;
    const username = document.getElementById("device-username-input").value;
    const password = document.getElementById("device-password-input").value;
    const deviceType = document.getElementById("device-type-input").value;

    const btnSubmit = document.getElementById("btn-submit-device");
    btnSubmit.disabled = true;
    btnSubmit.innerText = "Đang kiểm tra kết nối SSH...";

    try {
      const response = await fetch(`${API_BASE_URL}/api/devices/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostname: hostname,
          ip_address: ipAddress,
          username: username,
          password: password,
          device_type: deviceType,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`Thành công: ${data.message} (Trạng thái SSH: ${data.is_online ? 'Online' : 'Offline'})`);
        addDeviceForm.reset();

        const modalEl = document.getElementById("addDeviceModal");
        if (modalEl && typeof bootstrap !== "undefined") {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }

        isInitialTopologyLoaded = false;
        localStorage.removeItem("nodePositions");
        refreshAllData();
      } else {
        alert(`Lỗi: ${data.error || "Không thể thêm thiết bị"}`);
      }
    } catch (error) {
      console.error("Lỗi thêm thiết bị:", error);
      alert("Không thể kết nối đến máy chủ Backend!");
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerText = "Lưu và kiểm tra SSH";
    }
  });
}

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

        isInitialTopologyLoaded = false;
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

        const deviceText = elements.portDeviceSelect.options[elements.portDeviceSelect.selectedIndex]?.text || "Device";
        portAssignments.unshift({
          portName: portName,
          vlanId: vlanId,
          deviceName: deviceText,
          timestamp: new Date().toLocaleTimeString("vi-VN"),
        });

        localStorage.setItem("portAssignments", JSON.stringify(portAssignments));
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

// 7. Tải và vẽ sơ đồ mạng dạng Canvas
async function loadTopology() {
  const container = document.getElementById("network-map");
  if (!container) return;

  if (networkInstance !== null && isInitialTopologyLoaded) {
    return;
  }

  container.innerHTML = `<p class="text-muted text-center py-5">Đang kết nối tải sơ đồ mạng...</p>`;

  try {
    const response = await fetch(`${API_BASE_URL}/api/topology/`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Không thể kết nối API sơ đồ mạng");

    const data = await response.json();
    if (!data.success) throw new Error(data.error || "Lỗi dữ liệu topology");

    const savedPositions = JSON.parse(localStorage.getItem("nodePositions")) || {};
    const processedNodes = data.nodes.map(node => {
      if (savedPositions[node.id]) {
        return { ...node, x: savedPositions[node.id].x, y: savedPositions[node.id].y };
      }
      return node;
    });

    const graphData = {
      nodes: new vis.DataSet(processedNodes),
      edges: new vis.DataSet(data.edges)
    };

    const options = {
      nodes: {
        font: { size: 14, face: "sans-serif", color: "#1e293b" },
        margin: 14,
        shadow: true,
        shape: "box",
        borderRadius: 6
      },
      edges: {
        width: 2,
        color: { color: "#64748b" },
        smooth: { type: "cubicBezier", roundness: 0.2 }
      },
      physics: false,
      interaction: { 
        hover: true, 
        dragNodes: true, 
        dragView: true,  
        zoomView: true 
      }
    };

    if (networkInstance !== null) {
      networkInstance.destroy();
    }
    
    networkInstance = new vis.Network(container, graphData, options);
    isInitialTopologyLoaded = true;

    networkInstance.fit();

    networkInstance.on("dragEnd", function (params) {
      if (params.nodes.length > 0) {
        const positions = networkInstance.getPositions(params.nodes);
        let currentSaved = JSON.parse(localStorage.getItem("nodePositions")) || {};
        params.nodes.forEach(nodeId => {
          if (positions[nodeId]) {
            currentSaved[nodeId] = { x: positions[nodeId].x, y: positions[nodeId].y };
          }
        });
        localStorage.setItem("nodePositions", JSON.stringify(currentSaved));
      }
    });

  } catch (error) {
    console.error("Lỗi vẽ sơ đồ mạng:", error);
    container.innerHTML = `<p class="text-danger text-center py-5">Không thể tải dữ liệu sơ đồ mạng từ Backend.</p>`;
  }
}

async function deleteDevice(deviceId) {
  if (!confirm("Bạn có chắc chắn muốn xóa thiết bị này không?")) return;
  try {
    const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/delete/`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (response.ok && data.success) {
      alert("Đã xóa thiết bị thành công!");
      isInitialTopologyLoaded = false;
      localStorage.removeItem("nodePositions");
      refreshAllData();
    } else {
      alert(`Lỗi: ${data.error || "Không thể xóa thiết bị"}`);
    }
  } catch (error) {
    console.error("Lỗi khi xóa thiết bị:", error);
    alert("Không thể kết nối đến máy chủ Backend!");
  }
}

async function deleteVlan(vlanPk) {
  if (!confirm("Bạn có chắc chắn muốn xóa VLAN này (sẽ chạy lệnh 'no vlan' qua SSH)?")) return;
  try {
    const response = await fetch(`${API_BASE_URL}/api/vlans/${vlanPk}/delete/`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (response.ok && data.success) {
      alert(`Thành công: ${data.message}`);
      isInitialTopologyLoaded = false;
      localStorage.removeItem("nodePositions");
      refreshAllData();
    } else {
      alert(`Lỗi: ${data.error || "Không thể xóa VLAN"}`);
    }
  } catch (error) {
    console.error("Lỗi khi xóa VLAN:", error);
    alert("Không thể kết nối đến máy chủ Backend!");
  }
}

async function deletePort(index) {
  if (!confirm("Bạn có chắc chắn muốn xóa bản ghi gán Port này không?")) return;
  portAssignments.splice(index, 1);
  localStorage.setItem("portAssignments", JSON.stringify(portAssignments));
  renderPortTable();
  alert("Đã xóa bản ghi Port thành công!");
}

async function refreshAllData() {
  elements.refreshButton.disabled = true;
  await Promise.all([
    checkBackend(),
    fetchStats(),
    fetchDevices(),
    fetchVlans(),
    loadTopology()
  ]);
  renderPortTable();
  elements.refreshButton.disabled = false;
}

elements.refreshButton.addEventListener("click", () => {
  isInitialTopologyLoaded = false;
  localStorage.removeItem("nodePositions");
  refreshAllData();
});

refreshAllData();