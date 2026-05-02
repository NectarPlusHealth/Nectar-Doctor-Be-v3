
# Node.js + TypeScript + MongoDB Setup

This project is a simple Express application using TypeScript, MongoDB (via Mongoose), and environment-specific configurations for both development and production environments.

## Project Structure

```
node-ts-project/
├── node_modules/           # All installed dependencies
├── src/                    # Source code
│   ├── controllers/        # Logic for handling routes
│   │   ├── indexController.ts
│   │   ├── userController.ts
│   ├── routes/             # Express route handlers
│   │   ├── index.ts
│   │   ├── users.ts
│   ├── models/             # Mongoose models
│   │   ├── User.ts
│   ├── config/             # Configuration files for database and environment
│   │   ├── db.ts
│   │   ├── environment.ts
│   ├── server.ts           # Express server setup
├── environment/            # Environment-specific configuration files
│   ├── .env.development
│   ├── .env.production
├── package.json            # Project metadata and dependencies
├── tsconfig.json           # TypeScript configuration
├── .gitignore              # Git ignore file
```

## Prerequisites

Before running the project, make sure you have the following installed:

- **Node.js** (v14 or higher)
- **MongoDB** (Running locally or using MongoDB Atlas)

## Installation

1. Clone this repository to your local machine:

   ```bash
   git clone https://github.com/yourusername/node-ts-project.git
   ```

2. Navigate into the project directory:

   ```bash
   cd node-ts-project
   ```

3. Install the dependencies:

   ```bash
   npm install
   ```

4. Set up your environment variables:
   
   Create `.env` files for development and production inside the `environment/` folder.

   - **`environment/.env.development`**:

     ```env
     NODE_ENV=development
     PORT=3000
     MONGO_URI=mongodb://localhost:27017/devDatabase
     JWT_SECRET=dev_secret_key
     ```

   - **`environment/.env.production`**:

     ```env
     NODE_ENV=production
     PORT=8080
     MONGO_URI=mongodb://<username>:<password>@cluster.mongodb.net/prodDatabase
     JWT_SECRET=prod_secret_key
     ```

## Project Setup

### 1. **Database Configuration**

The project uses **MongoDB** to store data, and **Mongoose** to interact with the database. The database URL and credentials are stored in the environment variables.

- **`src/config/db.ts`**: This file handles the connection to the MongoDB database using the `mongoose` library.
  
- **`src/config/environment.ts`**: This file loads the correct environment variables based on the current `NODE_ENV` (development or production).

### 2. **Models**

Mongoose models are used to define the structure of data in MongoDB. For example, the `User` model is defined in **`src/models/User.ts`**.

### 3. **Controllers**

The controller files in **`src/controllers/`** define the logic for handling routes. For example:
- **`userController.ts`**: Handles operations like retrieving users, creating a new user, etc.

### 4. **Routes**

Express routes are defined in **`src/routes/`**. These files map HTTP methods (GET, POST, etc.) to corresponding controller actions. For example:
- **`users.ts`**: Defines routes for `/users` and `/users/:id`.

### 5. **Server Setup**

The main application is set up in **`src/server.ts`**, where the MongoDB connection is made, routes are applied, and the Express server is started.

---

## Environment Setup

The project uses **dotenv** to manage environment variables. Depending on the `NODE_ENV`, the appropriate `.env` file is loaded to configure the application for either development or production environments.

The configuration file is located at **`src/config/environment.ts`**. It loads the relevant `.env` file based on the current `NODE_ENV`.

---

## Running the Application

1. **Development Mode**

   To start the application in development mode (with hot-reloading), use:

   ```bash
   npm run start:dev
   ```

2. **Production Mode**

   To run the application in production, build the TypeScript code and then run the app:

   ```bash
   npm run build
   npm run start:prod
   ```

3. **Build the Project**

   If you need to build the project manually, use the following command:

   ```bash
   npm run build
   ```

   This will compile the TypeScript files into JavaScript in the `dist` folder.

---

## API Endpoints

The application exposes the following API routes:

### 1. **Base Route**

- **GET** `/`
  
  Returns a welcome message.

### 2. **User Routes**

- **GET** `/users`

  Retrieves a list of all users.

- **GET** `/users/:id`

  Retrieves a user by ID.

- **POST** `/users`

  Creates a new user. You must provide a JSON body with the following fields:
  
  ```json
  {
    "name": "John Doe",
    "email": "john.doe@example.com",
    "password": "securepassword"
  }
  ```

---

## Configuration

The application uses environment variables stored in `.env` files for development and production environments. These include:

- `PORT`: Port on which the application will run.
- `MONGO_URI`: MongoDB connection string.
- `JWT_SECRET`: Secret key for JWT token generation.

### Example for `.env.development`:

```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/devDatabase
JWT_SECRET=dev_secret_key
```

### Example for `.env.production`:

```env
NODE_ENV=production
PORT=8080
MONGO_URI=mongodb://<username>:<password>@cluster.mongodb.net/prodDatabase
JWT_SECRET=prod_secret_key
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Troubleshooting

- **Error: "MongoDB connection failed"**: Double-check your `MONGO_URI` in the `.env` files. Ensure your MongoDB instance is running and reachable.
- **JWT_SECRET is missing**: Make sure the secret key is set in the `.env` files.

---
