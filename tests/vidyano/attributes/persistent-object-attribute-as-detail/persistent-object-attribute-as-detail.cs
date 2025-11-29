#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*
#:package Bogus@35.*

using System.ComponentModel.DataAnnotations;
using Bogus;
using Vidyano.Core.Services;
using Vidyano.Service;
using Vidyano.Service.Repository;
using Vidyano.Service.Repository.Builder;

Randomizer.Seed = new Random(8675309); // Deterministic seed for consistent bogus data

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano =>
{
    vidyano
        .WithDefaultAdmin()
        .WithDefaultUser("Admin")
        .WithSchemaRights()
        .WithMenuItem(nameof(MockContext.Categories))
        .WithModel(builder =>
        {
            var categoryPo = builder.GetOrCreatePersistentObject(nameof(Category));

            var categoryProductsQuery = builder.AddDetailQuery(nameof(Category), nameof(ProductActions.Category_Products));
            var productsAsDetailAttr = categoryPo.GetOrCreateAttributeAsDetail(nameof(ProductActions.Category_Products));
            productsAsDetailAttr.Details = categoryProductsQuery;
            productsAsDetailAttr.ColumnSpan = 4;
            productsAsDetailAttr.SetLabel(nameof(MockContext.Products));

            // Additional AsDetail attribute with LookupAttribute for testing dialog flow
            var categoryProductsWithLookupQuery = builder.AddDetailQuery(nameof(Category), nameof(ProductActions.Category_ProductsWithLookup));
            var productsWithLookupAttr = categoryPo.GetOrCreateAttributeAsDetail(nameof(ProductActions.Category_ProductsWithLookup));
            productsWithLookupAttr.Details = categoryProductsWithLookupQuery;
            productsWithLookupAttr.ColumnSpan = 4;
            productsWithLookupAttr.SetLabel("Products (Lookup)");
            productsWithLookupAttr.LookupAttribute = nameof(Product.BrandId);

            // Additional AsDetail attribute with TriggersRefresh for testing refresh behavior
            var categoryProductsWithRefreshQuery = builder.AddDetailQuery(nameof(Category), nameof(ProductActions.Category_ProductsWithRefresh));
            var productsWithRefreshAttr = categoryPo.GetOrCreateAttributeAsDetail(nameof(ProductActions.Category_ProductsWithRefresh));
            productsWithRefreshAttr.Details = categoryProductsWithRefreshQuery;
            productsWithRefreshAttr.ColumnSpan = 4;
            productsWithRefreshAttr.SetLabel("Products (Refresh)");
            productsWithRefreshAttr.TriggersRefresh = true;

            var productPo = builder.GetOrCreatePersistentObject(nameof(Product));

            var colorAttr = productPo.GetOrCreateAttribute(nameof(Product.Color));
            colorAttr.DefaultOptions = "Red\nBlue\nGreen\nYellow\nBlack\nWhite";

            var priceAttr = productPo.GetOrCreateAttribute(nameof(Product.Price));
            priceAttr.DataTypeHints = "DisplayFormat=€ {0:N2}";
        });
});

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Category> categories = [];
    private static readonly List<Brand> brands = [];
    private static readonly List<Product> products = [];

    static MockContext()
    {
        var categoryFaker = new Faker<Category>()
            .RuleFor(c => c.Id, f => f.IndexFaker.ToString())
            .RuleFor(c => c.Name, f => f.Commerce.Categories(1)[0]);

        categories.AddRange(categoryFaker.Generate(5));

        // Ensure "Electronics" is always the first category for deterministic testing
        if (categories.Count > 0)
            categories[0].Name = "Electronics";

        var brandFaker = new Faker<Brand>()
            .RuleFor(b => b.Id, f => f.IndexFaker.ToString())
            .RuleFor(b => b.Name, f => f.Company.CompanyName());

        brands.AddRange(brandFaker.Generate(10));

        var productFaker = new Faker<Product>()
            .RuleFor(p => p.Id, f => f.IndexFaker.ToString())
            .RuleFor(p => p.Name, f => f.Commerce.ProductName())
            .RuleFor(p => p.CategoryId, f => f.PickRandom(categories).Id)
            .RuleFor(p => p.BrandId, f => f.PickRandom(brands).Id)
            .RuleFor(p => p.Color, f => f.PickRandom("Red", "Blue", "Green", "Yellow", "Black", "White"))
            .RuleFor(p => p.InStock, f => f.Random.Bool())
            .RuleFor(p => p.Price, f => Math.Round(f.Random.Decimal(1, 1000), 2));

        products.AddRange(productFaker.Generate(20));
    }

    public MockContext()
    {
        Register(categories);
        Register(brands);
        Register(products);
    }

    public IQueryable<Category> Categories => Query<Category>();
    public IQueryable<Brand> Brands => Query<Brand>();
    public IQueryable<Product> Products => Query<Product>();

    public static Category GetOrCreateCategory(string objectId)
    {
        var category = categories.FirstOrDefault(c => c.Id == objectId);

        if (category == null)
            categories.Add(category = new Category { Id = objectId });

        return category;
    }

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is Category category)
            category.Id ??= (categories.Count + 1).ToString();
        else if (entity is Brand brand)
            brand.Id ??= (brands.Count + 1).ToString();
        else if (entity is Product product)
            product.Id ??= (products.Count + 1).ToString();

        base.AddObject(obj, entity);
    }
}

public class MockWeb : CustomApiController
{
    public override void GetWebsiteContent(WebsiteArgs args)
    {
        base.GetWebsiteContent(args);

        var frontEndUrl = ServiceLocator.GetService<IConfiguration>()["frontend:url"];
        if (!string.IsNullOrEmpty(frontEndUrl))
            args.Contents = args.Contents.Replace("https://unpkg.com/@vidyano/vidyano/index.min.js", frontEndUrl);
    }
}

public class CategoryActions(MockContext context) : PersistentObjectActions<MockContext, Category>(context)
{
    public override Category? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        // Strip the |open-in-edit suffix if present
        var objectId = obj.ObjectId;
        if (objectId.EndsWith("|open-in-edit"))
            objectId = objectId[..^"|open-in-edit".Length];

        return MockContext.GetOrCreateCategory(objectId);
    }

    public override void OnLoad(PersistentObject obj, PersistentObject? parent)
    {
        base.OnLoad(obj, parent);

        // Conditionally set OpenInEdit based on objectId pattern
        if (obj.ObjectId?.EndsWith("|open-in-edit") == true)
            obj.StateBehavior = StateBehavior.OpenInEdit;
    }
}

public class ProductActions(MockContext context) : PersistentObjectActions<MockContext, Product>(context)
{
    public IEnumerable<Product> Category_Products(CustomQueryArgs args)
    {
        args.EnsureParent(nameof(Category));

        // Strip the |open-in-edit suffix if present
        var categoryId = args.Parent.ObjectId;
        if (categoryId?.EndsWith("|open-in-edit") == true)
            categoryId = categoryId[..^"|open-in-edit".Length];

        return Context.Products.Where(p => p.CategoryId == categoryId);
    }

    // Same query but for testing LookupAttribute feature
    public IEnumerable<Product> Category_ProductsWithLookup(CustomQueryArgs args)
    {
        args.EnsureParent(nameof(Category));

        var categoryId = args.Parent.ObjectId;
        if (categoryId?.EndsWith("|open-in-edit") == true)
            categoryId = categoryId[..^"|open-in-edit".Length];

        return Context.Products.Where(p => p.CategoryId == categoryId);
    }

    // Same query but for testing TriggersRefresh feature
    public IEnumerable<Product> Category_ProductsWithRefresh(CustomQueryArgs args)
    {
        args.EnsureParent(nameof(Category));

        var categoryId = args.Parent.ObjectId;
        if (categoryId?.EndsWith("|open-in-edit") == true)
            categoryId = categoryId[..^"|open-in-edit".Length];

        return Context.Products.Where(p => p.CategoryId == categoryId);
    }
}

public class Category
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
}

public class Brand
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
}

public class Product
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    [Reference(typeof(Category))]
    public string CategoryId { get; set; } = null!;
    [Reference(typeof(Brand))]
    public string? BrandId { get; set; }
    [DataType(DataTypes.DropDown)]
    public string Color { get; set; } = string.Empty;
    public bool InStock { get; set; }
    public decimal Price { get; set; }
}