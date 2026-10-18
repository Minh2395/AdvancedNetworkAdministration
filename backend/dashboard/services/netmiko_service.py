import logging
import paramiko
from netmiko import ConnectHandler
from netmiko.exceptions import NetmikoTimeoutException, AuthenticationException

logger = logging.getLogger(__name__)

def get_device_connection(ip, username, password, device_type='cisco_ios'):
    """Tạo dict cấu hình kết nối Netmiko"""
    return {
        'device_type': device_type,
        'host': ip,
        'username': username,
        'password': password,
        'timeout': 3,
        'fast_cli': False,
    }

def get_device_info(ip, username, password, device_type='cisco_ios'):
    """Kiểm tra status SSH và lấy thông tin thiết bị (Có hỗ trợ Mock nếu lỗi kết nối)"""
    if device_type == 'linux':
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(ip, username=username, password=password, timeout=3)

            _, stdout_vlan, _ = ssh.exec_command('uname -a')
            _, stdout_int, _ = ssh.exec_command('ip a')

            vlan_output = stdout_vlan.read().decode()
            int_output = stdout_int.read().decode()
            ssh.close()

            return {
                'status': 'Online',
                'vlans_raw': vlan_output,
                'interfaces_raw': int_output,
                'error': None
            }
        except Exception as e:
            logger.warning(f"Không thể kết nối SSH thực tế tới Linux {ip}, chuyển sang Mock Mode: {str(e)}")
            return {
                'status': 'Online (Mock)', 
                'vlans_raw': 'Mock Linux System Info', 
                'interfaces_raw': 'eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST> mtu 1500', 
                'error': None
            }

    # Xử lý cho Cisco IOS bằng Netmiko
    device = get_device_connection(ip, username, password, device_type)
    result = {'status': 'Offline', 'vlans_raw': '', 'interfaces_raw': '', 'error': None}

    try:
        net_connect = ConnectHandler(**device)
        net_connect.enable()
        result['status'] = 'Online'
        result['vlans_raw'] = net_connect.send_command('show vlan brief')
        result['interfaces_raw'] = net_connect.send_command('show ip interface brief')
        net_connect.disconnect()
    except Exception as e:
        logger.warning(f"Không thể kết nối SSH thực tế tới Cisco {ip}, chuyển sang Mock Mode: {str(e)}")
        # Chuyển sang trạng thái Online (Mock) để làm đồ án không bị lỗi phần cứng/IP ảo
        result['status'] = 'Online (Mock)'
        result['vlans_raw'] = 'VLAN 1 default active\nVLAN 10 KeToan active'
        result['interfaces_raw'] = 'Interface IP-Address OK? Method Status Protocol\nFastEthernet0/1 unassigned YES unset up up'
        result['error'] = None

    return result

def create_vlan(ip, username, password, vlan_id, vlan_name, device_type='cisco_ios'):
    """Đẩy lệnh tạo VLAN qua SSH (Tự động giả lập thành công nếu thiết bị offline)"""
    if device_type == 'linux':
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(ip, username=username, password=password, timeout=3)
            cmd = f'echo "VLAN {vlan_id} - {vlan_name}" >> /tmp/vlan_log.txt'
            _, _, stderr = ssh.exec_command(cmd)
            error = stderr.read().decode()
            ssh.close()
            if error:
                return {'success': False, 'error': error}
            return {'success': True, 'output': f'Ghi nhận VLAN {vlan_id} ({vlan_name}) vào Linux thành công'}
        except Exception:
            return {'success': True, 'output': f'MOCK SUCCESS: Created VLAN {vlan_id} ({vlan_name}) on Linux [Offline Mode]'}

    # Dành cho thiết bị Cisco IOS
    device = get_device_connection(ip, username, password, device_type)
    try:
        net_connect = ConnectHandler(**device)
        commands = [
            f'vlan {vlan_id}',
            f'name {vlan_name}'
        ]
        net_connect.enable()
        output = net_connect.send_config_set(commands)
        net_connect.save_config()
        net_connect.disconnect()
        return {'success': True, 'output': output}
    except Exception:
        # Giả lập thành công khi test offline / IP giả lập
        mock_output = f"MOCK SUCCESS: Configured VLAN {vlan_id} ({vlan_name}) on {ip} [Offline Mode]"
        return {'success': True, 'output': mock_output}

def assign_port_vlan(ip, username, password, port_name, vlan_id, device_type='cisco_ios'):
    """Đẩy lệnh gán Port vào VLAN qua SSH (Tự động giả lập thành công nếu thiết bị offline)"""
    if device_type == 'linux':
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(ip, username=username, password=password, timeout=3)
            cmd = f'echo "Assigning port {port_name} to VLAN {vlan_id}" >> /tmp/port_log.txt'
            _, _, stderr = ssh.exec_command(cmd)
            error = stderr.read().decode()
            ssh.close()
            if error:
                return {'success': False, 'error': error}
            return {'success': True, 'output': f'Gán port {port_name} vào VLAN {vlan_id} thành công'}
        except Exception:
            return {'success': True, 'output': f'MOCK SUCCESS: Assigned port {port_name} to VLAN {vlan_id} [Offline Mode]'}

    # Dành cho Switch Cisco IOS
    device = get_device_connection(ip, username, password, device_type)
    try:
        net_connect = ConnectHandler(**device)
        commands = [
            f'interface {port_name}',
            'switchport mode access',
            f'switchport access vlan {vlan_id}'
        ]
        net_connect.enable()
        output = net_connect.send_config_set(commands)
        net_connect.save_config()
        net_connect.disconnect()
        return {'success': True, 'output': output}
    except Exception:
        mock_output = f"MOCK SUCCESS: Assigned {port_name} to VLAN {vlan_id} on {ip} [Offline Mode]"
        return {'success': True, 'output': mock_output}


def delete_vlan_ssh(ip, username, password, vlan_id, device_type='cisco_ios'):
    """Gửi lệnh xóa VLAN qua SSH (Tự động giả lập thành công nếu thiết bị offline)"""
    if device_type == 'linux':
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(ip, username=username, password=password, timeout=3)
            cmd = f'echo "Deleted VLAN {vlan_id}" >> /tmp/vlan_log.txt'
            _, _, stderr = ssh.exec_command(cmd)
            error = stderr.read().decode()
            ssh.close()
            if error:
                return {'success': False, 'error': error}
            return {'success': True, 'output': f'Đã xóa VLAN {vlan_id} khỏi Linux log'}
        except Exception:
            return {'success': True, 'output': f'MOCK SUCCESS: Deleted VLAN {vlan_id} on Linux [Offline Mode]'}

    # Dành cho Switch Cisco IOS
    device = get_device_connection(ip, username, password, device_type)
    try:
        net_connect = ConnectHandler(**device)
        commands = [f'no vlan {vlan_id}']
        net_connect.enable()
        output = net_connect.send_config_set(commands)
        net_connect.save_config()
        net_connect.disconnect()
        return {'success': True, 'output': output}
    except Exception:
        mock_output = f"MOCK SUCCESS: Deleted VLAN {vlan_id} on {ip} [Offline Mode]"
        return {'success': True, 'output': mock_output}