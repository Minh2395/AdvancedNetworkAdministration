import json
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

# Import Models và Services đã định nghĩa
from .models import Device, VLAN
from .services.netmiko_service import get_device_info, create_vlan, assign_port_vlan


def api_status(request):
    """API kiểm tra trạng thái Backend"""
    return JsonResponse({
        "success": True,
        "message": "Network Dashboard Backend is running",
        "framework": "Django REST Framework",
        "network_automation": "Netmiko",
        "timestamp": timezone.now().isoformat(),
    })


def get_stats(request):
    """GET /api/stats/ - Trả về thống kê cho 4 thẻ Overview trên Dashboard"""
    total_devices = Device.objects.count()
    online_devices = Device.objects.filter(is_online=True).count()
    total_vlans = VLAN.objects.count()

    return JsonResponse({
        'total_devices': total_devices,
        'online_devices': online_devices,
        'total_vlans': total_vlans,
        'backend_status': 'Online'
    })


@csrf_exempt
def devices_api(request):
    """GET /api/devices/ (Lấy danh sách) & POST /api/devices/ (Thêm thiết bị)"""
    if request.method == 'GET':
        devices = list(Device.objects.values('id', 'hostname', 'ip_address', 'device_type', 'is_online'))
        return JsonResponse({'success': True, 'devices': devices})

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            device = Device.objects.create(
                hostname=data['hostname'],
                ip_address=data['ip_address'],
                username=data['username'],
                password=data['password'],
                device_type=data.get('device_type', 'cisco_ios')
            )
            
            # Kiểm tra trạng thái SSH bằng Netmiko ngay khi tạo
            info = get_device_info(device.ip_address, device.username, device.password, device.device_type)
            device.is_online = (info['status'] == 'Online')
            device.save()

            return JsonResponse({
                'success': True, 
                'message': 'Thêm thiết bị thành công', 
                'id': device.id, 
                'is_online': device.is_online
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)


@csrf_exempt
def vlans_api(request):
    """GET /api/vlans/ - Lấy danh sách VLAN"""
    if request.method == 'GET':
        vlans = list(VLAN.objects.values('id', 'vlan_id', 'name', 'device__hostname', 'device__ip_address'))
        return JsonResponse({'success': True, 'vlans': vlans})


@csrf_exempt
def create_vlan_api(request):
    """POST /api/vlans/create/ - Đẩy lệnh tạo VLAN qua Netmiko SSH"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            device = Device.objects.get(id=data['device_id'])

            # Đẩy lệnh SSH cấu hình VLAN
            res = create_vlan(
                device.ip_address, 
                device.username, 
                device.password, 
                data['vlan_id'], 
                data['vlan_name'], 
                device.device_type
            )

            if res['success']:
                vlan, _ = VLAN.objects.get_or_create(
                    vlan_id=data['vlan_id'],
                    device=device,
                    defaults={'name': data['vlan_name']}
                )
                return JsonResponse({
                    'success': True, 
                    'message': f"Tạo VLAN {data['vlan_id']} thành công!", 
                    'output': res.get('output', '')
                })
            else:
                return JsonResponse({'success': False, 'error': res['error']}, status=400)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)


@csrf_exempt
def assign_port_api(request):
    """POST /api/ports/assign/ - Đẩy lệnh gán Port vào VLAN qua Netmiko SSH"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            device = Device.objects.get(id=data['device_id'])

            res = assign_port_vlan(
                device.ip_address, 
                device.username, 
                device.password, 
                data['port_name'], 
                data['vlan_id'], 
                device.device_type
            )

            if res['success']:
                return JsonResponse({
                    'success': True, 
                    'message': f"Gán Port {data['port_name']} vào VLAN {data['vlan_id']} thành công!"
                })
            else:
                return JsonResponse({'success': False, 'error': res['error']}, status=400)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)