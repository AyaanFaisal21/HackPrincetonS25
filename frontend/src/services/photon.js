// photon.js (FRONTEND SERVICE)
// Tells the BACKEND to send SMS alerts via Photon's API.
// The frontend never touches Photon directly — it asks the backend.
//
//   sendAlertToAll(contacts, userName)
//     → POST /api/alert to backend
//     → backend calls Photon → texts every contact
//     → returns [{ id, success, error? }]

const BACKEND_URL = "http://localhost:3001";

export async function sendAlertToAll(contacts, userName) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/alert`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ contacts, userName }),
    });
    if (!response.ok) throw new Error(`Backend returned ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error("Alert failed:", err);
    // Return failure shape so the UI can still show "failed" state
    return contacts.map(c => ({ id: c.id, success: false, error: err.message }));
  }
}
