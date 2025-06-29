// server.js (v2)
const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = 3000;

let swatData = [];
let attackData = [];

// --- Time Parsing Functions ---
function parseSwatTimestamp(ts) {
    if (!ts || typeof ts !== 'string' || ts.split(' ').length < 3) {
        return null;
    }
    const [datePart, timePart, ampm] = ts.trim().split(' ');
    const [day, month, year] = datePart.split('/');
    if (!timePart) return null;
    let [hoursStr, minutesStr, secondsStr] = timePart.split(':');
    let hours = parseInt(hoursStr, 10);

    if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
    
    return new Date(Date.UTC(year, parseInt(month, 10) - 1, parseInt(day, 10), hours, parseInt(minutesStr, 10), parseInt(secondsStr || 0, 10)));
}

function parseAttackTimes(row) {
    const startTimeStr = row['Start Time'];
    const endTimeStr = row['End Time'];
    if (!startTimeStr || !endTimeStr) return { startTime: null, endTime: null };
    
    // Parse Start Time (e.g., "28/12/2015 10:29:14")
    const startParts = startTimeStr.split(' ');
    if (startParts.length < 2) return { startTime: null, endTime: null };
    const [startDatePart, startTimePart] = startParts;
    const [startDay, startMonth, startYear] = startDatePart.split('/');
    const [startHours, startMinutes, startSeconds] = startTimePart.split(':');
    const startTime = new Date(Date.UTC(startYear, startMonth - 1, startDay, startHours, startMinutes, startSeconds));

    // Parse End Time (e.g., "10:44:53")
    const [endHours, endMinutes, endSeconds] = endTimeStr.split(':');
    let endTime = new Date(startTime);
    endTime.setUTCHours(endHours, endMinutes, endSeconds, 0);

    if (endTime < startTime) {
        endTime.setUTCDate(endTime.getUTCDate() + 1);
    }
    return { startTime, endTime };
}


// --- Data Loading ---
function loadData() {
    // Load Attack Data First
    fs.createReadStream(path.join(__dirname, 'data', 'Attack.csv'))
        .pipe(csv())
        .on('data', (row) => {
            const { startTime, endTime } = parseAttackTimes(row);
            if (startTime && endTime) {
                attackData.push({
                    startTime,
                    endTime,
                    id: row['Attack #'] ? row['Attack #'].trim() : 'N/A', // <-- Added Attack ID
                    description: row['Attack'] ? row['Attack'].trim() : 'No description',
                    targets: row['Attack Point'] ? row['Attack Point'].split(';').map(p => p.trim().replace('-', '')) : [],
                });
            }
        })
        .on('end', () => {
            console.log(`Attack data loaded: ${attackData.length} records.`);
            // Now load SWaT data
            loadSwatData();
        });
}

function loadSwatData() {
    fs.createReadStream(path.join(__dirname, 'data', 'SWaT_Dataset.csv'))
        .pipe(csv())
        .on('data', (row) => {
            const cleanedRow = {};
            for (const key in row) {
                cleanedRow[key.trim()] = row[key].trim();
            }
            cleanedRow.jsTimestamp = parseSwatTimestamp(cleanedRow.Timestamp);
            if(cleanedRow.jsTimestamp) {
                swatData.push(cleanedRow);
            }
        })
        .on('end', () => {
            swatData.sort((a, b) => a.jsTimestamp - b.jsTimestamp);
            console.log(`SWaT dataset loaded and sorted: ${swatData.length} records.`);
        });
}

// --- API Endpoints ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/data/info', (req, res) => {
    if (swatData.length > 0) {
        res.json({
            totalRecords: swatData.length,
            startTime: swatData[0].Timestamp,
            endTime: swatData[swatData.length - 1].Timestamp,
            // Optionally send all timestamps if needed for a client-side search, but it can be large
        });
    } else {
        res.status(503).json({ error: 'Data not loaded yet.' });
    }
});

app.get('/api/data/by-index/:index', (req, res) => {
    const index = parseInt(req.params.index, 10);
    if (isNaN(index) || index < 0 || index >= swatData.length) {
        return res.status(404).json({ error: 'Index out of bounds' });
    }

    const currentData = swatData[index];
    // Provide previous data point for change calculation
    const prevData = index > 0 ? swatData[index - 1] : null; 
    const currentTime = currentData.jsTimestamp;

    const activeAttack = attackData.find(attack => 
        currentTime >= attack.startTime && currentTime <= attack.endTime
    );

    res.json({
        timestampData: currentData,
        prevTimestampData: prevData, // <-- Added previous data
        attackInfo: {
            isActive: !!activeAttack,
            attackId: activeAttack ? activeAttack.id : null, // <-- Added Attack ID
            description: activeAttack ? activeAttack.description : null,
            targets: activeAttack ? activeAttack.targets : []
        }
    });
});

// New endpoint to find an index by a timestamp string
app.get('/api/data/by-timestamp', (req, res) => {
    const timeQuery = req.query.time;
    if (!timeQuery) {
        return res.status(400).json({ error: 'Missing time query parameter.' });
    }
    
    // Attempt to parse the user's input with the same logic
    const targetDate = parseSwatTimestamp(timeQuery + " AM") || parseSwatTimestamp(timeQuery + " PM") ;

    if (!targetDate) {
         // A simplified fallback for "YYYY-MM-DD HH:MM:SS"
        const isoAttempt = new Date(timeQuery);
        if (isNaN(isoAttempt.getTime())) {
            return res.status(400).json({ error: 'Invalid time format. Use "DD/MM/YYYY HH:MM:SS".' });
        }
        targetDate = isoAttempt;
    }

    // Binary search would be faster, but for simplicity, we use findIndex
    const targetTime = targetDate.getTime();
    let closestIndex = -1;
    let minDiff = Infinity;

    swatData.forEach((record, index) => {
        const diff = Math.abs(record.jsTimestamp.getTime() - targetTime);
        if (diff < minDiff) {
            minDiff = diff;
            closestIndex = index;
        }
    });

    if (closestIndex !== -1) {
        res.json({ index: closestIndex, timestamp: swatData[closestIndex].Timestamp });
    } else {
        res.status(404).json({ error: 'Could not find a close match for the specified time.' });
    }
});


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    loadData();
});
