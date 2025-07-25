// Gemini Files API handling

// Upload a file to Gemini Files API (supports PDF and TXT)
export async function uploadFileToGemini(file, apiKey) {
    try {
        // Determine content type
        let contentType = file.type;
        if (!contentType) {
            if (file.name.toLowerCase().endsWith('.txt')) {
                contentType = 'text/plain';
            } else if (file.name.toLowerCase().endsWith('.pdf')) {
                contentType = 'application/pdf';
            }
        }
        
        // Step 1: Initiate resumable upload
        const initResponse = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': file.size.toString(),
                'X-Goog-Upload-Header-Content-Type': contentType,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file: {
                    display_name: file.name
                }
            })
        });

        if (!initResponse.ok) {
            throw new Error(`Failed to initiate upload: ${initResponse.statusText}`);
        }

        // Get upload URL from header
        const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
        if (!uploadUrl) {
            throw new Error('No upload URL received');
        }

        // Step 2: Upload the file
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'X-Goog-Upload-Offset': '0',
                'X-Goog-Upload-Command': 'upload, finalize',
                'Content-Type': contentType
            },
            body: file
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
        }

        const fileData = await uploadResponse.json();
        console.log('File uploaded successfully:', fileData);
        
        return {
            uri: fileData.file.uri,
            mimeType: fileData.file.mimeType,
            displayName: fileData.file.displayName,
            sizeBytes: fileData.file.sizeBytes,
            expirationTime: fileData.file.expirationTime
        };
    } catch (error) {
        console.error('Error uploading file to Gemini:', error);
        throw error;
    }
}

// Delete a file from Gemini Files API
export async function deleteFileFromGemini(fileUri, apiKey) {
    try {
        // Extract file ID from URI
        const fileId = fileUri.split('/').pop();
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileId}?key=${apiKey}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`Failed to delete file: ${response.statusText}`);
        }

        console.log('File deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting file:', error);
        return false;
    }
}

// List uploaded files
export async function listGeminiFiles(apiKey) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/files?key=${apiKey}`);
        
        if (!response.ok) {
            throw new Error(`Failed to list files: ${response.statusText}`);
        }

        const data = await response.json();
        return data.files || [];
    } catch (error) {
        console.error('Error listing files:', error);
        return [];
    }
}