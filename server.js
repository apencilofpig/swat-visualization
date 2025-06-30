// server.js (v14)
const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = 3000;

let swatData = [];
let attackData = [];

// --- Time Parsing and Formatting Functions ---

/**
 * Parses a timestamp string from SWaT datasets.
 * Handles both formats: 'DD/MM/YYYY HH:MM:SS AM/PM' and 'DD/MM/YYYY HH:MM:SS' (24-hour).
 * @param {string} ts - The timestamp string.
 * @returns {Date|null} A Date object or null if parsing fails.
 */
function parseSwatTimestamp(ts) {
    if (!ts || typeof ts !== 'string') { return null; }
    
    const parts = ts.trim().split(' ');
    if (parts.length < 2) { return null; } // Must have at least date and time parts.

    const [datePart, timePart, ampm] = parts;
    const [day, month, year] = datePart.split('/');

    if (!timePart || !year || !month || !day) return null; // Basic validation
    
    const [hoursStr, minutesStr, secondsStr] = timePart.split(':');
    let hours = parseInt(hoursStr, 10);

    // Handle 12-hour format with AM/PM if present
    if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hours !== 12) {
            hours += 12;
        }
        if (ampm.toUpperCase() === 'AM' && hours === 12) {
            hours = 0; // Midnight case
        }
    }
    // If ampm is not present, 'hours' is assumed to be in 24-hour format.
    
    const date = new Date(Date.UTC(year, parseInt(month, 10) - 1, parseInt(day, 10), hours, parseInt(minutesStr, 10), parseInt(secondsStr || 0, 10)));
    
    // Check if the created date is valid
    if (isNaN(date.getTime())) {
        return null;
    }
    
    return date;
}


function parseAttackTimes(row) {
    const startTimeStr = row['Start Time'];
    const endTimeStr = row['End Time'];
    if (!startTimeStr || !endTimeStr) return { startTime: null, endTime: null };
    
    const startTime = parseSwatTimestamp(startTimeStr);
    if (!startTime) return { startTime: null, endTime: null };

    // The end time in the CSV is just a time, so we apply it to the start time's date.
    const [endHours, endMinutes, endSeconds] = endTimeStr.split(':');
    let endTime = new Date(startTime);
    endTime.setUTCHours(endHours, endMinutes, endSeconds, 0);

    // If end time is earlier than start time, it's on the next day.
    if (endTime < startTime) {
        endTime.setUTCDate(endTime.getUTCDate() + 1);
    }
    return { startTime, endTime };
}

function formatDateForQuery(date) {
    const d = new Date(date);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    // This format does not include AM/PM, which is fine because our new parseSwatTimestamp handles it.
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}


// --- Data Loading ---
function loadData() {
    fs.createReadStream(path.join(__dirname, 'data', 'Attack.csv'))
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on('data', (row) => {
            const { startTime, endTime } = parseAttackTimes(row);
            if (startTime && endTime) {
                attackData.push({ startTime, endTime, id: row['Attack #'] || 'N/A', description: row['Attack'] || 'No description', targets: row['Attack Point'] ? row['Attack Point'].split(';').map(p => p.trim().replace('-', '')) : [] });
            }
        })
        .on('end', () => {
            console.log(`Attack data loaded: ${attackData.length} records.`);
            loadSwatData();
        });
}

function loadSwatData() {
    fs.createReadStream(path.join(__dirname, 'data', 'SWaT_Dataset.csv'))
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on('data', (row) => {
            row.jsTimestamp = parseSwatTimestamp(row.Timestamp);
            if(row.jsTimestamp) { swatData.push(row); }
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
        const deviceNames = Object.keys(swatData[0]).filter(k => !['Timestamp', 'jsTimestamp', 'Normal/Attack'].includes(k));
        res.json({ totalRecords: swatData.length, startTime: swatData[0].Timestamp, endTime: swatData[swatData.length - 1].Timestamp, deviceNames: deviceNames });
    } else { res.status(503).json({ error: 'Data not loaded yet.' }); }
});

app.get('/api/attacks', (req, res) => {
    if (attackData.length > 0) {
        const attackList = attackData.map(attack => ({
            id: attack.id,
            description: attack.description,
            startTime: formatDateForQuery(attack.startTime) 
        })).sort((a,b) => {
            const numA = parseInt(a.id.replace('Attack #', '').trim());
            const numB = parseInt(b.id.replace('Attack #', '').trim());
            return numA - numB;
        });
        res.json(attackList);
    } else {
        res.status(503).json({ error: 'Attack data not loaded yet.' });
    }
});


app.get('/api/data/by-index/:index', (req, res) => {
    const index = parseInt(req.params.index, 10);
    if (isNaN(index) || index < 0 || index >= swatData.length) { return res.status(404).json({ error: 'Index out of bounds' }); }
    const currentData = swatData[index];
    const prevData = index > 0 ? swatData[index - 1] : null; 
    const currentTime = currentData.jsTimestamp;
    const activeAttack = attackData.find(attack => currentTime >= attack.startTime && currentTime <= attack.endTime);
    res.json({ timestampData: currentData, prevTimestampData: prevData, attackInfo: { isActive: !!activeAttack, attackId: activeAttack ? activeAttack.id : null, description: activeAttack ? activeAttack.description : null, targets: activeAttack ? activeAttack.targets : [] } });
});

app.get('/api/data/by-timestamp', (req, res) => {
    const timeQuery = req.query.time;
    if (!timeQuery) { return res.status(400).json({ error: 'Missing time query parameter.' }); }
    const targetDate = parseSwatTimestamp(timeQuery);
    if (!targetDate) { return res.status(400).json({ error: 'Invalid time format. Use "DD/MM/YYYY HH:MM:SS" format.' }); }
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
    if (closestIndex !== -1) { res.json({ index: closestIndex, timestamp: swatData[closestIndex].Timestamp }); } 
    else { res.status(404).json({ error: 'Could not find a close match for the specified time.' }); }
});

app.get('/api/data/history', (req, res) => {
    const { deviceId, endIndex, seconds } = req.query;
    if (!deviceId || !endIndex || !seconds) {
        return res.status(400).json({ error: 'Missing required parameters: deviceId, endIndex, seconds' });
    }

    const end = parseInt(endIndex, 10);
    const duration = parseInt(seconds, 10);

    if (isNaN(end) || isNaN(duration)) {
        return res.status(400).json({ error: 'Invalid numerical parameters.' });
    }
    
    const start = Math.max(0, end - duration);

    if (start >= swatData.length) {
        return res.json([]); 
    }

    const historySlice = swatData.slice(start, end + 1);
    
    const chartData = historySlice.map(record => ({
        jsTimestamp: record.jsTimestamp.getTime(), 
        value: parseFloat(record[deviceId])
    }));

    res.json(chartData);
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    loadData();
});
