# Kushi Trader - Bill Creation Web Application

A comprehensive bill creation and management system for Kushi Trader.

## Features

- **Authentication**
  - Admin login
  - Secure session management

- **Dashboard**
  - Overview of key features
  - Quick access to main functions

- **Bill Creation**
  - Customer information management
  - Product selection by category
  - Multiple product addition
  - Payment type selection (Cash/Credit)
  - PDF bill generation

- **Product Management**
  - Add, edit, and delete products
  - Categorize products (Board, Chanel, Hardware, Bori)
  - Set product prices

- **Customer Management**
  - View all customers
  - View customer bill history
  - Search customers

- **Bill Management**
  - View all bills
  - Download bills as PDF
  - Search bills

## Tech Stack

- **Frontend**: EJS, Bootstrap 5
- **Backend**: Node.js, Express
- **Database**: MongoDB Atlas
- **PDF Generation**: PDFKit

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd billcreate
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   NODE_ENV=development
   PORT=3000
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database-name>?retryWrites=true&w=majority
   JWT_SECRET=<strong-random-string>
   SESSION_SECRET=<different-strong-random-string>
   ```

   Note: For production, set `NODE_ENV=production`

4. Create an admin user:
   ```
   npm run create-admin
   ```

5. Start the application:
   ```
   npm start
   ```

   For development with auto-reload:
   ```
   npm run dev
   ```

6. Access the application at `http://localhost:3000`

## Default Admin Credentials

- **Username**: admin
- **Password**: admin123

## Security Considerations

1. **MongoDB Atlas Security**
   - The application uses MongoDB Atlas for database hosting
   - Ensure your MongoDB Atlas connection string is kept secure and not committed to public repositories
   - Use IP whitelisting in MongoDB Atlas to restrict access to your database
   - Create a dedicated database user with appropriate permissions

2. **Environment Variables**
   - Keep your `.env` file secure and never commit it to version control
   - Use strong, unique values for JWT_SECRET and SESSION_SECRET

3. **Authentication**
   - Change the default admin credentials immediately after first login
   - Consider implementing password policies (minimum length, complexity)

4. **Production Deployment**
   - Use HTTPS in production
   - Consider adding rate limiting to prevent brute force attacks
   - Implement proper logging for security events

## License

ISC
