import React, { useState } from 'react';

interface DishFormData {
    name: string;
    description: string;
    price: string;
    category: string;
    image_url: string;
    glb_file: File | null;
    usdz_file: File | null;
}

interface DishFormProps {
    onSubmit: (data: DishFormData) => Promise<void> | void;
}

const DishForm: React.FC<DishFormProps> = ({ onSubmit }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        image_url: '',
        glb_file: null as File | null,
        usdz_file: null as File | null,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files } = e.target;
        const file = files && files.length > 0 ? files[0] : null;
        setFormData(prev => ({ ...prev, [name]: file }));
    };

    const hasValidExtension = (file: File | null, ext: string) => {
        if (!file) return true;
        return file.name.toLowerCase().endsWith(ext);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        const hasGlb = !!formData.glb_file;
        const hasUsdz = !!formData.usdz_file;

        if (!hasGlb && !hasUsdz) {
            setFormError('Please upload at least one model file (.glb or .usdz).');
            return;
        }

        if (!hasValidExtension(formData.glb_file, '.glb')) {
            setFormError('GLB file must end with .glb');
            return;
        }

        if (!hasValidExtension(formData.usdz_file, '.usdz')) {
            setFormError('USDZ file must end with .usdz');
            return;
        }

        setIsSubmitting(true);

        // Convert price to number for mock
        const submissionData = {
            ...formData,
            price: parseFloat(formData.price) || 0
        };

        try {
            await onSubmit(submissionData);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Dish Name *
                </label>
                <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Margherita Pizza"
                />
            </div>

            {/* Description */}
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                </label>
                <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Classic pizza with tomato sauce, fresh mozzarella, and basil"
                />
            </div>

            {/* Price & Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                        Price ($) *
                    </label>
                    <input
                        type="number"
                        id="price"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        required
                        step="0.01"
                        min="0"
                        className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="12.99"
                    />
                </div>

                <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                        Category *
                    </label>
                    <input
                        type="text"
                        id="category"
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Pizza, Appetizers, Desserts"
                    />
                </div>
            </div>

            {/* Image URL (Optional) */}
            <div>
                <label htmlFor="image_url" className="block text-sm font-medium text-gray-700 mb-1">
                    Preview Image URL (Optional)
                </label>
                <input
                    type="url"
                    id="image_url"
                    name="image_url"
                    value={formData.image_url}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://example.com/pizza.jpg"
                />
                <p className="mt-1 text-xs text-gray-500">
                    This is a placeholder. Real implementation would include file upload.
                </p>
            </div>

            {/* 3D Assets */}
            <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-800 mb-2">3D Assets</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="glb_file" className="block text-sm font-medium text-gray-700 mb-1">
                            GLB File (Android/WebXR)
                        </label>
                        <input
                            type="file"
                            id="glb_file"
                            name="glb_file"
                            accept=".glb"
                            onChange={handleFileChange}
                            className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="usdz_file" className="block text-sm font-medium text-gray-700 mb-1">
                            USDZ File (iOS AR)
                        </label>
                        <input
                            type="file"
                            id="usdz_file"
                            name="usdz_file"
                            accept=".usdz"
                            onChange={handleFileChange}
                            className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <p className="text-xs text-gray-500">
                        Upload at least one file. Allowed extensions: .glb, .usdz
                    </p>
                </div>
            </div>

            {formError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                    {formError}
                </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="flex-1 px-4 py-2 border border-gray-300 text-black rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting || !formData.name || !formData.price || !formData.category}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors ${isSubmitting || !formData.name || !formData.price || !formData.category
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                >
                    {isSubmitting ? (
                        <span className="flex items-center justify-center">
                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                            Creating...
                        </span>
                    ) : (
                        'Create Dish (MOCK)'
                    )}
                </button>
            </div>
        </form>
    );
};

export default DishForm;
