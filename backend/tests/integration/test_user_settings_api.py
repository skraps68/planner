"""Integration coverage for authenticated per-user settings."""


def test_user_settings_lifecycle(client, auth_headers):
    initial = client.get("/api/v1/users/me/settings", headers=auth_headers)
    assert initial.status_code == 200
    assert initial.json()["settings"] == {}

    updated = client.patch(
        "/api/v1/users/me/settings",
        headers=auth_headers,
        json={
            "version": initial.json()["version"],
            "patch": {
                "navigation": {
                    "hierarchyPane": {"width": 348, "collapsed": True},
                    "landingDestination": "resources",
                },
                "assignmentGrids": {
                    "projectPerspective": "non_labor",
                    "project": {
                        "period": "weekly",
                        "chartVisible": False,
                        "displayMode": "variance",
                    },
                    "nonLaborProject": {
                        "period": "monthly",
                        "chartVisible": True,
                        "displayMode": "combined",
                    },
                },
            },
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["settings"]["navigation"]["hierarchyPane"]["width"] == 348
    assert body["settings"]["assignmentGrids"]["project"] == {
        "period": "weekly",
        "chartVisible": False,
        "displayMode": "variance",
    }
    assert body["settings"]["assignmentGrids"]["projectPerspective"] == "non_labor"
    assert body["settings"]["assignmentGrids"]["nonLaborProject"] == {
        "period": "monthly",
        "chartVisible": True,
        "displayMode": "combined",
    }

    partial = client.patch(
        "/api/v1/users/me/settings",
        headers=auth_headers,
        json={
            "version": body["version"],
            "patch": {"navigation": {"hierarchyPane": {"width": 392}}},
        },
    )
    assert partial.status_code == 200
    assert partial.json()["settings"]["navigation"]["hierarchyPane"] == {
        "width": 392,
        "collapsed": True,
    }

    stale = client.patch(
        "/api/v1/users/me/settings",
        headers=auth_headers,
        json={
            "version": body["version"],
            "patch": {"navigation": {"hierarchyPane": {"width": 400}}},
        },
    )
    assert stale.status_code == 409

    reset = client.delete("/api/v1/users/me/settings", headers=auth_headers)
    assert reset.status_code == 200
    assert reset.json()["settings"] == {}


def test_user_settings_reject_invalid_preferences(client, auth_headers):
    initial = client.get("/api/v1/users/me/settings", headers=auth_headers).json()
    response = client.patch(
        "/api/v1/users/me/settings",
        headers=auth_headers,
        json={
            "version": initial["version"],
            "patch": {
                "navigation": {
                    "hierarchyPane": {"width": 5000},
                    "landingDestination": "unauthorized-route",
                },
            },
        },
    )
    assert response.status_code == 422
