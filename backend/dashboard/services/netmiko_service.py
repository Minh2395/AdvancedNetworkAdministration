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
        'timeout': 5,
        'fast_cli': False,
    }

def get_device_info(ip, username, password, device_type='cisco_ios'):
    """Kiểm tra status SSH và lấy thông tin thiết bị"""
    if device_type == 'linux':
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(ip, username=username, password=password, timeout=5)

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
            logger.error(f"Lỗi kết nối Linux {ip}: {str(e)}")
            return {'status': 'Offline', 'vlans': [], 'interfaces': [], 'error': str(e)}

    # Xử lý cho Cisco IOS bằng Netmiko
    device = get_device_connection(ip, username, password, device_type)
    result = {'status': 'Offline', 'vlans': [], 'interfaces': [], 'error': None}

    try:
        net_connect = ConnectHandler(**device)
        net_connect.enable()
        result['status'] = 'Online'
        result['vlans_raw'] = net_connect.send_command('show vlan brief')
        result['interfaces_raw'] = net_connect.send_command('show ip interface brief')
        net_connect.disconnect()
    except (NetmikoTimeoutException, AuthenticationException) as e:
        result['error'] = str(e)
        logger.error(f"Lỗi kết nối tới {ip}: {str(e)}")
    except Exception as e:
        result['error'] = f"Lỗi không xác định: {str(e)}"
        logger.error(f"Lỗi tại {ip}: {str(e)}")

    return result

def create_vlan(ip, username, password, vlan_id, vlan_name, device_type='cisco_ios'):
    """Đẩy lệnh tạo VLAN qua SSH"""
    if device_type == 'linux':
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(ip, username=username, password=password, timeout=5)

            cmd = f'echo "VLAN {vlan_id} - {vlan_name}" >> /tmp/vlan_log.txt'
            _, stdout, stderr = ssh.exec_command(cmd)

            error = stderr.read().decode()
            ssh.close()

            if error:
                return {'success': False, 'error': error}
            return {'success': True, 'output': f'Ghi nhận VLAN {vlan_id} ({vlan_name}) vào /tmp/vlan_log.txt thành công'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

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
    except Exception as e:
        return {'success': False, 'error': str(e)}

def assign_port_vlan(ip, username, password, port_name, vlan_id, device_type='cisco_ios'):
    """Đẩy lệnh gán Port vào VLAN qua SSH"""
    if device_type == 'linux':
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(ip, username=username, password=password, timeout=5)

            cmd = f'echo "Assigning port {port_name} to VLAN {vlan_id}" >> /tmp/port_log.txt'
            _, stdout, stderr = ssh.exec_command(cmd)

            error = stderr.read().decode()
            ssh.close()

            if error:
                return {'success': False, 'error': error}
            return {'success': True, 'output': f'Gán port {port_name} vào VLAN {vlan_id} thành công'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

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
    except Exception as e:
        return {'success': False, 'error': str(e)}