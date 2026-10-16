
from django.urls import path
from . import views

app_name = "dashboard"

urlpatterns = [
    # API kiểm tra trạng thái
    path("api/status/", views.api_status, name="api_status"),
    
    # API Thống kê cho Dashboard
    path("api/stats/", views.get_stats, name="api_stats"),
    
    # API Quản lý Thiết bị
    path("api/devices/", views.devices_api, name="api_devices"),
    
    # API Quản lý VLAN
    path("api/vlans/", views.vlans_api, name="api_vlans"),
    path("api/vlans/create/", views.create_vlan_api, name="api_create_vlan"),
    
    # API Gán Port vào VLAN
    path("api/ports/assign/", views.assign_port_api, name="api_assign_port"),
]
