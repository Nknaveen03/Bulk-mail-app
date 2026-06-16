# Deployment Guide - AeroSend Bulk Mail Application

This document provides step-by-step instructions to deploy the AeroSend application to production. We will host the **Frontend on Vercel**, the **Backend on Render**, and the **Database on MongoDB Atlas**.

---

## Part 1: Database Setup (MongoDB Atlas)

Since local MongoDB won't be accessible by Render in production, we need a cloud database:

1. Sign up/Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new free cluster (Shared tier, e.g., M0).
3. In **Database Access**, create a user with read/write privileges (note the username and password).
4. In **Network Access**, click **Add IP Address** and select **Allow Access from Anywhere** (IP `0.0.0.0/0`). This is necessary because Render servers have dynamic outbound IPs.
5. In **Database/Clusters**, click **Connect** -> **Drivers** (Node.js). Copy the connection URI:
   ```text
   mongodb+srv://<username>:<password>@cluster0.xxxxxx.mongodb.net/bulk-mail-db?retryWrites=true&w=majority
   ```
   *Replace `<username>` and `<password>` with the credentials of the database user you created.*

---

## Part 2: Backend Deployment (Render)

Render is ideal for hosting Node.js/Express APIs.

1. Sign up/Log in to [Render](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository containing the project.
4. Configure the service:
   - **Name**: `aerosend-backend`
   - **Runtime**: `Node`
   - **Root Directory**: `backend` *(Since the backend is in a subfolder)*
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js` or `npm start`
5. Click **Advanced** to add **Environment Variables**:
   - `MONGO_URI` = `mongodb+srv://...` *(Your MongoDB Atlas URI)*
   - `JWT_SECRET` = `a_very_long_secure_random_string`
   - `ADMIN_USERNAME` = `admin` *(Default admin username)*
   - `ADMIN_PASSWORD` = `choose_a_strong_password` *(Default admin password seeded on startup)*
   - `PORT` = `5000`
6. Click **Create Web Service**.
7. Once successfully deployed, copy the Render service URL (e.g., `https://aerosend-backend.onrender.com`).

---

## Part 3: Frontend Deployment (Vercel)

Vercel is optimized for static and React applications built with Vite.

1. Sign up/Log in to [Vercel](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` *(Since the frontend is in a subfolder)*
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Open the **Environment Variables** section and add:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://aerosend-backend.onrender.com/api` *(Replace with your actual Render URL, appending `/api` at the end)*
6. Click **Deploy**.
7. Vercel will build your React code and provide a live URL (e.g., `https://aerosend-frontend.vercel.app`).

---

## Verification

1. Navigate to the live Vercel URL.
2. Log in using the `ADMIN_USERNAME` and `ADMIN_PASSWORD` you configured on Render.
3. Launch a bulk email test campaign and watch the progress bar update in real time!
