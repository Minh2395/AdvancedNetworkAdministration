import json
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

# Import Models và Services đã định nghĩa
from .models import Device, VLAN
from .services.netmiko_service import (
    get_device_info, create_vlan, assign_port_vlan, delete_vlan_ssh
)


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


@csrf_exempt
def delete_device_api(request, pk):
    """DELETE /api/devices/<pk>/delete/ - Xóa thiết bị khỏi Database"""
    if request.method == 'DELETE':
        try:
            device = Device.objects.get(pk=pk)
            device.delete()
            return JsonResponse({'success': True, 'message': 'Xóa thiết bị thành công!'})
        except Device.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Không tìm thấy thiết bị!'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)


@csrf_exempt
def delete_vlan_api(request, pk):
    """DELETE /api/vlans/<pk>/delete/ - Xóa VLAN qua SSH và Database"""
    if request.method == 'DELETE':
        try:
            vlan = VLAN.objects.get(pk=pk)
            device = vlan.device

            # Gọi SSH xóa VLAN thực tế trên thiết bị
            res = delete_vlan_ssh(
                device.ip_address,
                device.username,
                device.password,
                vlan.vlan_id,
                device.device_type
            )

            if res['success']:
                vlan.delete()
                return JsonResponse({
                    'success': True,
                    'message': f'Xóa VLAN {vlan.vlan_id} thành công!',
                    'output': res.get('output', '')
                })
            else:
                return JsonResponse({'success': False, 'error': res['error']}, status=400)

        except VLAN.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Không tìm thấy VLAN!'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)


@csrf_exempt
def delete_port_api(request, pk):
    """DELETE /api/ports/<pk>/delete/ - Xóa hoặc hủy gán Port"""
    if request.method == 'DELETE':
        try:
            return JsonResponse({'success': True, 'message': 'Xóa Port thành công!'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)


@csrf_exempt
def topology_api(request):
    """GET /api/topology/ - Trả về danh sách Nodes và Edges định dạng cho Vis.js với vị trí x, y cố định"""
    if request.method == 'GET':
        try:
            devices = Device.objects.all()
            
            # Node 0: Django Core Server ở trên cùng (x=0, y=-120)
            nodes = [{
                "id": 0,
                "label": "Django Core Server\n(127.0.0.1)",
                "shape": "box",
                "x": 0,
                "y": -120,
                "color": {"background": "#1e293b", "border": "#0f172a"},
                "font": {"color": "#ffffff"}
            }]
            edges = []

            # Khoảng cách dàn hàng ngang cho các thiết bị
            x_offset = -200 if devices.count() > 1 else 0
            x_step = 250

            for index, dev in enumerate(devices):
                dev_x = x_offset + (index * x_step)
                dev_y = 30  # Thiết bị nằm ở tầng giữa
                color = "#10b981" if dev.is_online else "#ef4444"
                shape = "database" if dev.device_type == "linux" else "box"
                
                # Node thiết bị
                nodes.append({
                    "id": dev.id,
                    "label": f"{dev.hostname}\n({dev.ip_address})",
                    "shape": shape,
                    "x": dev_x,
                    "y": dev_y,
                    "color": {"background": "#ffffff", "border": color},
                    "borderWidth": 2
                })
                
                # Cáp nối SSH (Đã xóa bỏ hoàn toàn label để đường dây sạch sẽ)
                edges.append({
                    "from": 0,
                    "to": dev.id,
                    "color": {"color": color},
                    "dashes": not dev.is_online
                })

                # Các VLAN thuộc thiết bị này dàn ra ở tầng dưới (y = 180)
                vlans = dev.vlans.all()
                vlan_x_offset = dev_x - ((len(vlans) - 1) * 60 if len(vlans) > 1 else 0)
                for v_idx, vlan in enumerate(vlans):
                    vlan_node_id = f"vlan_{vlan.id}"
                    nodes.append({
                        "id": vlan_node_id,
                        "label": f"VLAN {vlan.vlan_id}\n{vlan.name}",
                        "shape": "ellipse",
                        "x": vlan_x_offset + (v_idx * 120),
                        "y": 180,
                        "color": {"background": "#e0f2fe", "border": "#0284c7"}
                    })
                    # Đường nối từ thiết bị xuống VLAN
                    edges.append({
                        "from": dev.id,
                        "to": vlan_node_id,
                        "color": {"color": "#0284c7"}
                    })

            return JsonResponse({
                "success": True,
                "nodes": nodes,
                "edges": edges
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)
    return JsonResponse({'success': False, 'error': 'Method not allowed'}, status=405)