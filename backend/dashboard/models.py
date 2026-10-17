from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Device(models.Model):
    """Thiết bị mạng (router/switch) được quản lý qua SSH bằng Netmiko."""

    DEVICE_TYPES = [
        ("cisco_ios", "Cisco IOS"),
        ("cisco_xe", "Cisco IOS-XE"),
        ("cisco_nxos", "Cisco NX-OS"),
        ("juniper_junos", "Juniper Junos"),
        ("hp_procurve", "HP ProCurve"),
    ]
    STATUS_CHOICES = [
        ("unknown", "Unknown"),
        ("online", "Online"),
        ("offline", "Offline"),
    ]

    name = models.CharField(max_length=100, unique=True)
    ip_address = models.GenericIPAddressField(unique=True)
    device_type = models.CharField(
        max_length=30, choices=DEVICE_TYPES, default="cisco_ios"
    )
    ssh_port = models.PositiveIntegerField(default=22)
    username = models.CharField(max_length=100)
    # LƯU Ý: demo đồ án. Thực tế nên mã hóa hoặc đọc từ biến môi trường / vault.
    password = models.CharField(max_length=255)
    secret = models.CharField(
        max_length=255, blank=True, help_text="Enable password (nếu có)"
    )
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default="unknown"
    )
    last_checked = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.ip_address})"

    def connection_params(self):
        """Tham số truyền vào netmiko.ConnectHandler."""
        params = {
            "device_type": self.device_type,
            "host": self.ip_address,
            "port": self.ssh_port,
            "username": self.username,
            "password": self.password,
            "timeout": 15,
            "conn_timeout": 15,
        }
        if self.secret:
            params["secret"] = self.secret
        return params


class Vlan(models.Model):
    """VLAN đã tạo trên một thiết bị."""

    device = models.ForeignKey(
        Device, on_delete=models.CASCADE, related_name="vlans"
    )
    vlan_id = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(4094)]
    )
    name = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["device", "vlan_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["device", "vlan_id"], name="unique_vlan_per_device"
            )
        ]

    def __str__(self):
        return f"VLAN {self.vlan_id} ({self.name}) @ {self.device.name}"


class PortAssignment(models.Model):
    """Cổng (interface) được gán vào VLAN ở chế độ access."""

    device = models.ForeignKey(
        Device, on_delete=models.CASCADE, related_name="port_assignments"
    )
    interface = models.CharField(max_length=50)  # vd: GigabitEthernet0/1
    vlan = models.ForeignKey(
        Vlan, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="ports",
    )
    description = models.CharField(max_length=100, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["device", "interface"]
        constraints = [
            models.UniqueConstraint(
                fields=["device", "interface"], name="unique_port_per_device"
            )
        ]

    def __str__(self):
        vlan = self.vlan.vlan_id if self.vlan else "none"
        return f"{self.device.name}:{self.interface} -> VLAN {vlan}"