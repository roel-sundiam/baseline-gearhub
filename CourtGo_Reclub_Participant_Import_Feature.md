# CourtGo — Reclub Participant Import Feature

I want to add a new feature to my CourtGo app called **Reclub Participant Import**.

## Goal

Players should NOT have to join the same Open Play twice.

The organizer will create/manage the Open Play in CourtGo and import the participants who already registered through Reclub. CourtGo will then use those participants for check-in and queue/stacking management.

The initial version should support:

1. **Copy/Paste Reclub Participant List**
2. **Screenshot Upload → OCR → Extract Names**
3. **Review and confirm imported players**
4. **Match imported names against existing CourtGo players**
5. **Create temporary/guest players when no CourtGo account is found**
6. **Use the imported players in the existing CourtGo Open Play queue**

---

## 1. Add "Import Players" to Open Play Management

Inside the organizer's Open Play management page, add a button:

**Import Players**

When clicked, show two options:

- 📋 **Paste Reclub Participant List**
- 📷 **Upload Reclub Screenshot**

Do NOT replace or remove the existing player management or queue functionality.

---

## 2. Copy/Paste Import

The organizer should be able to copy participant information from Reclub and paste it into CourtGo.

Example input:

```text
Juan Dela Cruz
Pedro Santos
Maria Garcia
Ana Reyes
Carlo Cruz
Lisa Tan
```

The copied content may contain additional information such as:

- Player names
- Ratings
- Status
- Labels
- Other Reclub text

The importer should extract the likely player names and ignore irrelevant information.

Do not assume that every line is a player name.

Create a clean list of extracted names.

---

## 3. Screenshot Import

Allow the organizer to upload a screenshot of the Reclub participant list.

Use OCR to extract the participant names.

The OCR process should:

- Extract text from the screenshot
- Identify likely player names
- Ignore irrelevant UI text
- Remove duplicate names
- Return a clean participant list

If an OCR result is uncertain, do not silently import it. Show it on the review screen so the organizer can correct it.

If the project already has an OCR library/service, use the existing implementation.

If no OCR solution currently exists, recommend the simplest appropriate implementation for the existing tech stack before adding a new dependency.

---

## 4. Review Screen

NEVER immediately add imported players.

After parsing the copied text or screenshot, show a review screen.

Example:

**Review Imported Players**

24 players found

| Reclub Name | CourtGo Match | Status |
|-------------|---------------|--------|
| Juan Dela Cruz | Juan Dela Cruz | ✅ Matched |
| Pedro Santos | Pedro Santos | ✅ Matched |
| Maria Garcia | Maria Garcia | ✅ Matched |
| Ana Reyes | — | 🆕 New Player |

The organizer must be able to:

- Edit a player name
- Remove a player
- Select a different CourtGo player match
- Mark a player as guest/temporary
- Add a missing player manually

Then provide:

**Import 24 Players**

---

## 5. Match Players Against CourtGo

For each imported Reclub name, search existing CourtGo players.

Do not rely only on exact string matching.

Support reasonable name variations such as:

- Roel Sundiam
- Roel S. Sundiam
- ROEL SUNDiam
- Sundiam, Roel

Use normalized names and fuzzy matching where appropriate.

Example:

Reclub:
"Roel Sundiam"

CourtGo:
"Roel S. Sundiam"

Result:

**95% match — Suggested**

The organizer can accept or change the match.

If there are multiple possible matches, show the possible matches and let the organizer select one.

Do NOT automatically assign a low-confidence match.

---

## 6. Players Without CourtGo Accounts

This is very important.

A Reclub participant does NOT need an existing CourtGo account to participate in the Open Play queue.

If no CourtGo player is found, create a temporary/guest participant associated with the Open Play.

Example:

**Maria Garcia**
Status: Guest

Guest participants should still be able to:

- Check in
- Enter the queue
- Be assigned to courts
- Appear in the queue display
- Participate in games
- Have game results recorded

Do not force the guest to create an account.

Later, we can allow the player to claim/link the temporary profile to a CourtGo account.

---

## 7. Check-In

After importing the Reclub participants, the organizer should have something like:

**Open Play**
24 Participants

**Checked In:** 0  
**Waiting:** 24  
**Playing:** 0

Generate/use the existing Open Play QR code.

When a player scans the QR code, they should see:

**Check In**

"Find your name"

[ Search ]

Then:

**Roel Sundiam**

[ Check In ]

The player is now checked into the CourtGo Open Play.

Important:

The player is NOT joining/registering for the Open Play again.

They are simply checking in to an Open Play they already registered for through Reclub.

---

## 8. Queue Integration

Once players are checked in, they should flow into the existing CourtGo queue/stacking system.

Example:

**NOW PLAYING**

Court 1  
Juan • Pedro  
Maria • Ana

Court 2  
Carlo • Lisa  
Mark • John

**NEXT**

James  
Sarah  
Mike  
Kevin

**WAITING**

David  
Chris  
Paul  
Tony

Do not create a second independent queue system if CourtGo already has one.

Use the existing queue/stacking logic and connect the imported participants to it.

---

## 9. Data Model

Design the implementation so that we can distinguish between:

- CourtGo registered player
- Reclub imported participant
- Temporary/guest participant

The Open Play should store the imported participant information and the relationship to a CourtGo player when a match exists.

Do not duplicate existing CourtGo player accounts.

If an imported Reclub participant matches an existing CourtGo player, reference the existing player record instead of creating another player.

---

## 10. Import History

Please consider storing basic import information:

- Open Play ID
- Import date/time
- Import method: `paste` or `screenshot`
- Original/imported name
- Matched CourtGo player ID, if any
- Guest/temporary status

This will help us debug and audit imports later.

---

## 11. Important UX Requirement

The entire process should be very simple for the organizer:

```text
Reclub
   ↓
Copy participant list OR take screenshot
   ↓
CourtGo
   ↓
Import Players
   ↓
Review
   ↓
Confirm
   ↓
Participants added
   ↓
Players arrive
   ↓
Scan QR
   ↓
Check In
   ↓
CourtGo Queue
   ↓
Play
   ↓
Rotate
```

The organizer should NOT have to manually add 20–30 players one by one.

---

## 12. Development Requirements

Before modifying code:

1. Inspect the existing CourtGo project structure.
2. Identify the existing Open Play/session models.
3. Identify the existing player/member models.
4. Identify the existing queue/stacking logic.
5. Identify the existing QR/check-in functionality.
6. Identify the current backend/API architecture.
7. Identify the current database structure.
8. Reuse existing components/services/models wherever possible.

Do not create duplicate functionality.

Before writing code, explain:

- Which existing files/components will be modified
- Which new files/components will be created
- Any database/model changes required
- Any new dependencies required
- How OCR will be implemented
- How name matching will work
- How guest participants will be represented

Then implement the feature incrementally.

### Important

Do not break existing CourtGo functionality.

Do not change existing queue/stacking behavior unless it is necessary to connect the imported participants.

Do not implement Reclub API integration yet.

For this first version, the supported import methods are ONLY:

**Copy/Paste → Parse → Review → Import**

and

**Screenshot → OCR → Review → Import**

Build the feature so that an official Reclub API integration could potentially be added later without redesigning the entire participant system.
