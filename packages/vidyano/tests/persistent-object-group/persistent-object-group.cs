#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using Vidyano.Core.Services;
using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithDefaultAdmin()
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Items))
    .WithModel(builder =>
    {
        var po = builder.GetOrCreatePersistentObject(nameof(Mock_Item));

        // Basic attributes for label tests
        var stringAttr = po.GetOrCreateAttribute(nameof(Mock_Item.String));
        stringAttr.DataType = "String";
        stringAttr.GroupLabel = "First Group";

        var intAttr = po.GetOrCreateAttribute(nameof(Mock_Item.Integer));
        intAttr.DataType = "Int32";
        intAttr.GroupLabel = "First Group";

        // === Test: Sequential (4 attributes in order) ===
        var seqPo = builder.GetOrCreatePersistentObject(nameof(Grid_Sequential));
        seqPo.GetOrCreateAttribute(nameof(Grid_Sequential.A)).DataType = "String";
        seqPo.GetOrCreateAttribute(nameof(Grid_Sequential.A)).Offset = 0;
        seqPo.GetOrCreateAttribute(nameof(Grid_Sequential.B)).DataType = "String";
        seqPo.GetOrCreateAttribute(nameof(Grid_Sequential.B)).Offset = 1;
        seqPo.GetOrCreateAttribute(nameof(Grid_Sequential.C)).DataType = "String";
        seqPo.GetOrCreateAttribute(nameof(Grid_Sequential.C)).Offset = 2;
        seqPo.GetOrCreateAttribute(nameof(Grid_Sequential.D)).DataType = "String";
        seqPo.GetOrCreateAttribute(nameof(Grid_Sequential.D)).Offset = 3;

        // === Test: Column Span ===
        var spanPo = builder.GetOrCreatePersistentObject(nameof(Grid_ColumnSpan));
        var spanA = spanPo.GetOrCreateAttribute(nameof(Grid_ColumnSpan.A));
        spanA.DataType = "String";
        spanA.Offset = 0;
        var spanWide = spanPo.GetOrCreateAttribute(nameof(Grid_ColumnSpan.Wide));
        spanWide.DataType = "String";
        spanWide.Offset = 1;
        spanWide.ColumnSpan = 2;
        var spanB = spanPo.GetOrCreateAttribute(nameof(Grid_ColumnSpan.B));
        spanB.DataType = "String";
        spanB.Offset = 2;

        // === Test: Row Span (Height) ===
        var heightPo = builder.GetOrCreatePersistentObject(nameof(Grid_RowSpan));
        var heightTall = heightPo.GetOrCreateAttribute(nameof(Grid_RowSpan.Tall));
        heightTall.DataType = "String";
        heightTall.Offset = 0;
        heightTall.DataTypeHints = "Height=2";
        var heightA = heightPo.GetOrCreateAttribute(nameof(Grid_RowSpan.A));
        heightA.DataType = "String";
        heightA.Offset = 1;
        var heightB = heightPo.GetOrCreateAttribute(nameof(Grid_RowSpan.B));
        heightB.DataType = "String";
        heightB.Offset = 2;

        // === Test: Large (2x2) ===
        var largePo = builder.GetOrCreatePersistentObject(nameof(Grid_Large));
        var largeBig = largePo.GetOrCreateAttribute(nameof(Grid_Large.Big));
        largeBig.DataType = "String";
        largeBig.Offset = 0;
        largeBig.ColumnSpan = 2;
        largeBig.DataTypeHints = "Height=2";
        var largeA = largePo.GetOrCreateAttribute(nameof(Grid_Large.A));
        largeA.DataType = "String";
        largeA.Offset = 1;
        var largeB = largePo.GetOrCreateAttribute(nameof(Grid_Large.B));
        largeB.DataType = "String";
        largeB.Offset = 2;

        // === Test: Positioned ===
        var posPo = builder.GetOrCreatePersistentObject(nameof(Grid_Positioned));
        var posA = posPo.GetOrCreateAttribute(nameof(Grid_Positioned.A));
        posA.DataType = "String";
        posA.Offset = 0;
        var posFixed = posPo.GetOrCreateAttribute(nameof(Grid_Positioned.Fixed));
        posFixed.DataType = "String";
        posFixed.Offset = 1;
        posFixed.Column = 2; // Force to column 2
        var posB = posPo.GetOrCreateAttribute(nameof(Grid_Positioned.B));
        posB.DataType = "String";
        posB.Offset = 2;

        // === Test: Hidden ===
        var hiddenPo = builder.GetOrCreatePersistentObject(nameof(Grid_Hidden));
        var hiddenA = hiddenPo.GetOrCreateAttribute(nameof(Grid_Hidden.A));
        hiddenA.DataType = "String";
        hiddenA.Offset = 0;
        var hiddenX = hiddenPo.GetOrCreateAttribute(nameof(Grid_Hidden.X));
        hiddenX.DataType = "String";
        hiddenX.Offset = 1;
        hiddenX.Visibility = AttributeVisibility.Never;
        var hiddenB = hiddenPo.GetOrCreateAttribute(nameof(Grid_Hidden.B));
        hiddenB.DataType = "String";
        hiddenB.Offset = 2;

        // === Test: Sanitization ===
        var sanitizePo = builder.GetOrCreatePersistentObject(nameof(Grid_Sanitize));
        var sanitizeAttr = sanitizePo.GetOrCreateAttribute("Test-Name_123");
        sanitizeAttr.DataType = "String";
        sanitizeAttr.Offset = 0;

        // === Test: Full Width ===
        var fullPo = builder.GetOrCreatePersistentObject(nameof(Grid_FullWidth));
        var fullA = fullPo.GetOrCreateAttribute(nameof(Grid_FullWidth.A));
        fullA.DataType = "String";
        fullA.Offset = 0;
        var fullFull = fullPo.GetOrCreateAttribute(nameof(Grid_FullWidth.Full));
        fullFull.DataType = "String";
        fullFull.Offset = 1;
        fullFull.ColumnSpan = 3;
        var fullB = fullPo.GetOrCreateAttribute(nameof(Grid_FullWidth.B));
        fullB.DataType = "String";
        fullB.Offset = 2;

        // === Test: Infinite Height (Height=0) ===
        var infPo = builder.GetOrCreatePersistentObject(nameof(Grid_InfiniteHeight));
        var infInfinite = infPo.GetOrCreateAttribute(nameof(Grid_InfiniteHeight.Infinite));
        infInfinite.DataType = "String";
        infInfinite.Offset = 0;
        infInfinite.DataTypeHints = "Height=0";
        var infA = infPo.GetOrCreateAttribute(nameof(Grid_InfiniteHeight.A));
        infA.DataType = "String";
        infA.Offset = 1;
        var infB = infPo.GetOrCreateAttribute(nameof(Grid_InfiniteHeight.B));
        infB.DataType = "String";
        infB.Offset = 2;
        var infC = infPo.GetOrCreateAttribute(nameof(Grid_InfiniteHeight.C));
        infC.DataType = "String";
        infC.Offset = 3;
    })
);

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Item> items = [];

    public MockContext()
    {
        Register(items);
    }

    public IQueryable<Mock_Item> Items => Query<Mock_Item>();

    public static Mock_Item GetOrCreateItem(string objectId)
    {
        var item = items.FirstOrDefault(a => a.Id == objectId);

        if (item == null)
            items.Add(item = new Mock_Item { Id = objectId });

        return item;
    }

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is Mock_Item item)
            item.Id ??= (items.Count + 1).ToString();

        base.AddObject(obj, entity);
    }
}

public class Mock_ItemActions(MockContext context) : PersistentObjectActions<MockContext, Mock_Item>(context)
{
    public override Mock_Item? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateItem(obj.ObjectId);
    }
}

public class Mock_Item
{
    public string Id { get; set; } = null!;
    public string? String { get; set; } = "Test String";
    public int Integer { get; set; } = 42;
}

// === Grid Test Models ===

public class Grid_Sequential
{
    public string Id { get; set; } = null!;
    public string? A { get; set; }
    public string? B { get; set; }
    public string? C { get; set; }
    public string? D { get; set; }
}

public class Grid_ColumnSpan
{
    public string Id { get; set; } = null!;
    public string? A { get; set; }
    public string? Wide { get; set; }
    public string? B { get; set; }
}

public class Grid_RowSpan
{
    public string Id { get; set; } = null!;
    public string? Tall { get; set; }
    public string? A { get; set; }
    public string? B { get; set; }
}

public class Grid_Large
{
    public string Id { get; set; } = null!;
    public string? Big { get; set; }
    public string? A { get; set; }
    public string? B { get; set; }
}

public class Grid_Positioned
{
    public string Id { get; set; } = null!;
    public string? A { get; set; }
    public string? Fixed { get; set; }
    public string? B { get; set; }
}

public class Grid_Hidden
{
    public string Id { get; set; } = null!;
    public string? A { get; set; }
    public string? X { get; set; }
    public string? B { get; set; }
}

public class Grid_Sanitize
{
    public string Id { get; set; } = null!;
}

public class Grid_FullWidth
{
    public string Id { get; set; } = null!;
    public string? A { get; set; }
    public string? Full { get; set; }
    public string? B { get; set; }
}

public class Grid_InfiniteHeight
{
    public string Id { get; set; } = null!;
    public string? Infinite { get; set; }
    public string? A { get; set; }
    public string? B { get; set; }
    public string? C { get; set; }
}
