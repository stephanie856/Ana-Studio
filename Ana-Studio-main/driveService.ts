// Google Drive Storage Service
export interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
  webViewLink: string;
  downloadUrl?: string;
}

let CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '690188678388-vfs077ia6jspbdp2pr24foavnvsnhb16.apps.googleusercontent.com';
let API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let gapiInited = false;
let gisInited = false;
let tokenClient: any = null;

const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) return resolve();
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error(`Failed to load ${src}`));
  document.body.appendChild(script);
});

export const setDriveConfig = (config: { apiKey: string; clientId: string }) => {
  API_KEY = config.apiKey;
  CLIENT_ID = config.clientId;
};

export const initializeGoogleAuth = async () => {
  await loadScript('https://apis.google.com/js/api.js');
  // @ts-ignore
  const gapiAny = window.gapi;
  await new Promise<void>((resolve) => {
    gapiAny.load('client', async () => {
      // Initialize client only if API key is available; otherwise just mark loaded.
      try {
        if (API_KEY && API_KEY !== 'YOUR_GOOGLE_API_KEY') {
          await gapiAny.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });
        }
      } catch {}
      gapiInited = true;
      resolve();
    });
  });
  await loadScript('https://accounts.google.com/gsi/client');
  if (!gisInited) {
    // @ts-ignore
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp: any) => {
        try {
          // Store token in gapi client for convenience
          gapiAny.client.setToken({ access_token: resp.access_token });
        } catch {}
      },
    });
    gisInited = true;
  }
};

export const handleAuthClick = async () => {
  if (!gapiInited || !gisInited) {
    await initializeGoogleAuth();
  }
  // @ts-ignore
  const gapiAny = window.gapi;
  if (gapiAny.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
};

export const uploadStickerToDrive = async (imageDataUrl: string, fileName: string): Promise<DriveFile | null> => {
  try {
    // @ts-ignore
    const gapiAny = window.gapi;
    const token = gapiAny.client.getToken();
    if (!token) {
      console.error('Not authenticated with Google Drive');
      return null;
    }

    // Convert data URL to blob
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();

    // Create form data
    const formData = new FormData();
    const metadata = {
      name: fileName,
      mimeType: 'image/png'
    };

    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append('file', blob);

    // Upload file
    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,webViewLink',
      {
        method: 'POST',
        headers: new Headers({ Authorization: `Bearer ${token.access_token}` }),
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error('Upload failed');
    }

    return await uploadResponse.json();
  } catch (error) {
    console.error('Error uploading to Drive:', error);
    return null;
  }
};

export const getStickerHistory = async (): Promise<DriveFile[]> => {
  try {
    // @ts-ignore
    const gapiAny = window.gapi;
    const token = gapiAny.client.getToken();
    if (!token) return [];

    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id,name,createdTime,webViewLink)',
      {
        headers: new Headers({ Authorization: `Bearer ${token.access_token}` }),
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error fetching from Drive:', error);
    return [];
  }
};

export const isAuthenticatedWithDrive = (): boolean => {
  try {
    // @ts-ignore
    const gapiAny = window.gapi;
    return !!(gapiAny && gapiAny.client && gapiAny.client.getToken());
  } catch {
    return false;
  }
};
