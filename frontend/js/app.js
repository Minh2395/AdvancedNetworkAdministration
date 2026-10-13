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
};

async function checkBackend() {
  elements.apiStatus.textContent = "...";
  elements.apiMessage.textContent = "Đang kết nối máy chủ";
  elements.refreshButton.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/api/status/`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.success !== true) {
      throw new Error("Backend trả về trạng thái không hợp lệ");
    }

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
  } finally {
    elements.refreshButton.disabled = false;
  }
}

elements.refreshButton.addEventListener("click", checkBackend);

checkBackend();
