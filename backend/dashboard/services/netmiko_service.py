import re
from contextlib import contextmanager

from netmiko import ConnectHandler
from netmiko.exceptions import (
    NetmikoAuthenticationException,
    NetmikoTimeoutException,
)

VLAN_NAME_RE = re.compile(r"^[A-Za-z0-9_-]{1,32}$")
INTERFACE_RE = re.compile(r"^[A-Za-z]+[\w\-]*\s?\d+(/\d+)*(\.\d+)?$")


class NetworkServiceError(Exception):
    """Lỗi nghiệp vụ / kết nối khi làm việc với thiết bị."""


@contextmanager
def _connect(device):
    """Mở kết nối SSH, tự động đóng khi xong. Đổi lỗi Netmiko thành thông báo dễ hiểu."""
    conn = None
    try:
        conn = ConnectHandler(**device.connection_params())
        if device.secret:
            conn.enable()
        yield conn
    except NetmikoAuthenticationException:
        raise NetworkServiceError("Sai username/password khi đăng nhập thiết bị.")
    except NetmikoTimeoutException:
        raise NetworkServiceError(
            f"Không kết nối được tới {device.ip_address} (timeout)."
        )
    except OSError as exc:
        raise NetworkServiceError(f"Lỗi mạng khi kết nối: {exc}")
    finally:
        if conn is not None:
            conn.disconnect()


def _validate_vlan(vlan_id, name=None):
    if not isinstance(vlan_id, int) or not 1 <= vlan_id <= 4094:
        raise NetworkServiceError("VLAN ID phải là số nguyên từ 1 đến 4094.")
    if name is not None and not VLAN_NAME_RE.match(name):
        raise NetworkServiceError(
            "Tên VLAN chỉ gồm chữ, số, '-' hoặc '_' (tối đa 32 ký tự)."
        )


def _validate_interface(interface):
    if not INTERFACE_RE.match(interface):
        raise NetworkServiceError(f"Tên interface không hợp lệ: {interface}")


def check_device(device):
    """Kiểm tra thiết bị có truy cập được qua SSH không, lấy thông tin phiên bản."""
    try:
        with _connect(device) as conn:
            output = conn.send_command("show version")
        return {
            "success": True,
            "message": "Thiết bị đang online.",
            "output": output,
        }
    except NetworkServiceError as exc:
        return {"success": False, "message": str(exc), "output": ""}


def get_vlans(device):
    """Lấy danh sách VLAN hiện có trên thiết bị."""
    with _connect(device) as conn:
        output = conn.send_command("show vlan brief")
    return {"success": True, "message": "OK", "output": output}


def get_interfaces(device):
    """Lấy trạng thái các interface."""
    with _connect(device) as conn:
        output = conn.send_command("show ip interface brief")
    return {"success": True, "message": "OK", "output": output}


def create_vlan(device, vlan_id, name):
    """Tạo VLAN trên thiết bị."""
    _validate_vlan(vlan_id, name)
    commands = [f"vlan {vlan_id}", f"name {name}"]
    with _connect(device) as conn:
        output = conn.send_config_set(commands)
        conn.save_config()
    return {
        "success": True,
        "message": f"Đã tạo VLAN {vlan_id} ({name}).",
        "output": output,
    }


def delete_vlan(device, vlan_id):
    """Xóa VLAN khỏi thiết bị."""
    _validate_vlan(vlan_id)
    with _connect(device) as conn:
        output = conn.send_config_set([f"no vlan {vlan_id}"])
        conn.save_config()
    return {
        "success": True,
        "message": f"Đã xóa VLAN {vlan_id}.",
        "output": output,
    }


def assign_port_to_vlan(device, interface, vlan_id, description=""):
    """Gán cổng vào VLAN ở chế độ access."""
    _validate_interface(interface)
    _validate_vlan(vlan_id)
    commands = [
        f"interface {interface}",
        "switchport mode access",
        f"switchport access vlan {vlan_id}",
    ]
    if description:
        # Bỏ ký tự xuống dòng để tránh chèn lệnh ngoài ý muốn
        safe_desc = description.replace("\n", " ").replace("\r", " ")[:100]
        commands.append(f"description {safe_desc}")
    with _connect(device) as conn:
        output = conn.send_config_set(commands)
        conn.save_config()
    return {
        "success": True,
        "message": f"Đã gán {interface} vào VLAN {vlan_id}.",
        "output": output,
    }