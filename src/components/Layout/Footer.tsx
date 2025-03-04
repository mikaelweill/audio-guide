export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-gray-600">© {new Date().getFullYear()} Audio Travel Guide</p>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="text-gray-600 hover:text-blue-500">Terms</a>
            <a href="#" className="text-gray-600 hover:text-blue-500">Privacy</a>
            <a href="#" className="text-gray-600 hover:text-blue-500">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
} 