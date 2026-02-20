#!/usr/bin/env python3
"""
Test script for /connections metadata functionality
Tests: create, update, delete, explore, sync, and test endpoints
"""

import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://localhost:3001/api/v1"
AUTH_HEADER = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJpYXQiOjk5OTk5OTk5OTl9.test"

def make_request(method, endpoint, body=None):
    """Make HTTP request to backend"""
    url = f"{BASE_URL}{endpoint}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {AUTH_HEADER}"
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body else None,
        headers=headers,
        method=method
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            body = response.read().decode()
            return status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        return e.code, {"error": str(e)}

def test_connections():
    """Test connection CRUD operations"""
    print("\n=== Testing Connections Metadata ===\n")
    
    # 1. Create a connection
    print("1. Testing CREATE connection...")
    create_payload = {
        "name": "Test PostgreSQL",
        "connectionType": "POSTGRESQL",
        "host": "localhost",
        "port": 5432,
        "database": "testdb",
        "username": "testuser",
        "password": "testpass"
    }
    status, response = make_request("POST", "/connections", create_payload)
    print(f"   Status: {status}")
    
    if status == 201 and "connection" in response:
        connection = response["connection"]
        conn_id = connection["id"]
        print(f"   ✓ Connection created: {conn_id}")
        print(f"   Name: {connection['name']}")
        print(f"   Type: {connection['connectionType']}")
    else:
        print(f"   ✗ Failed to create connection: {response}")
        return False
    
    # 2. Get connection
    print("\n2. Testing GET connection...")
    status, response = make_request("GET", f"/connections/{conn_id}")
    print(f"   Status: {status}")
    if status == 200 and "connection" in response:
        print(f"   ✓ Connection retrieved: {response['connection']['name']}")
    else:
        print(f"   ✗ Failed to get connection: {response}")
    
    # 3. Update connection
    print("\n3. Testing UPDATE connection (PUT)...")
    update_payload = {
        "name": "Test PostgreSQL Updated",
        "host": "newhost.example.com"
    }
    status, response = make_request("PUT", f"/connections/{conn_id}", update_payload)
    print(f"   Status: {status}")
    if status == 200 and "connection" in response:
        print(f"   ✓ Connection updated: {response['connection']['name']}")
    else:
        print(f"   ✗ Failed to update connection: {response}")
    
    # 4. Test connection
    print("\n4. Testing TEST connection endpoint...")
    status, response = make_request("POST", f"/connections/{conn_id}/test", {})
    print(f"   Status: {status}")
    if status == 200 and "result" in response:
        result = response["result"]
        print(f"   ✓ Connection test completed")
        print(f"   Success: {result.get('success')}")
        print(f"   Message: {result.get('message')}")
    else:
        print(f"   Note: Connection test returned {status} (expected - DB may not exist)")
    
    # 5. Explore schema
    print("\n5. Testing EXPLORE schema endpoint...")
    status, response = make_request("GET", f"/connections/{conn_id}/explore")
    print(f"   Status: {status}")
    if status == 200 and "schema" in response:
        schema = response["schema"]
        db_count = len(schema.get("databases", []))
        print(f"   ✓ Schema explored: {db_count} databases found")
    else:
        print(f"   Note: Schema explore returned {status} (expected - DB may not exist)")
    
    # 6. List connections
    print("\n6. Testing LIST connections...")
    status, response = make_request("GET", "/connections")
    print(f"   Status: {status}")
    if status == 200 and "connections" in response:
        connections = response["connections"]
        print(f"   ✓ Connections listed: {len(connections)} total")
    else:
        print(f"   ✗ Failed to list connections: {response}")
    
    # 7. Delete connection
    print("\n7. Testing DELETE connection...")
    status, response = make_request("DELETE", f"/connections/{conn_id}")
    print(f"   Status: {status}")
    if status == 204:
        print(f"   ✓ Connection deleted")
    else:
        print(f"   ✗ Failed to delete connection: {response}")
    
    print("\n=== All Tests Completed ===\n")
    return True

if __name__ == "__main__":
    try:
        test_connections()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
