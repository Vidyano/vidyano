#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using System.ComponentModel.DataAnnotations;
using Vidyano.Core.Services;
using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithUrls("http://localhost:44355")
    .WithDefaultAdmin()
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Attributes))
    .WithModel(builder =>
        {
            var po = builder.GetOrCreatePersistentObject(nameof(Mock_Attribute));

            var dropDown = po.GetOrCreateAttribute(nameof(Mock_Attribute.DropDown));
            dropDown.DefaultOptions = "Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday";

            var dropDownRadio = po.GetOrCreateAttribute(nameof(Mock_Attribute.DropDownRadio));
            dropDownRadio.DefaultOptions = "Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday";
            dropDownRadio.DataTypeHints = "inputtype=radio";

            var dropDownChip = po.GetOrCreateAttribute(nameof(Mock_Attribute.DropDownChip));
            dropDownChip.DefaultOptions = "Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday";
            dropDownChip.DataTypeHints = "inputtype=chip";

            var dropDownReadOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.DropDownReadOnly));
            dropDownReadOnly.DefaultOptions = "Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday";
            dropDownReadOnly.IsReadOnly = true;

            var dropDownRequired = po.GetOrCreateAttribute(nameof(Mock_Attribute.DropDownRequired));
            dropDownRequired.DefaultOptions = "Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday";
            dropDownRequired.AddRule("Required");

            var dropDownRadioHorizontal = po.GetOrCreateAttribute(nameof(Mock_Attribute.DropDownRadioHorizontal));
            dropDownRadioHorizontal.DefaultOptions = "Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday";
            dropDownRadioHorizontal.DataTypeHints = "inputtype=radio;orientation=horizontal";

            var dropDownChipHorizontal = po.GetOrCreateAttribute(nameof(Mock_Attribute.DropDownChipHorizontal));
            dropDownChipHorizontal.DefaultOptions = "Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday";
            dropDownChipHorizontal.DataTypeHints = "inputtype=chip;orientation=horizontal";
        })
    );

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Attribute> attributes = [];

    public MockContext()
    {
        Register(attributes);
    }

    public IQueryable<Mock_Attribute> Attributes => Query<Mock_Attribute>();

    public static Mock_Attribute GetOrCreateAttribute(string objectId)
    {
        var attribute = attributes.FirstOrDefault(a => a.Id == objectId);

        if (attribute == null)
            attributes.Add(attribute = new Mock_Attribute { Id = objectId });

        return attribute;
    }

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is Mock_Attribute attribute)
            attribute.Id ??= (attributes.Count + 1).ToString();

        base.AddObject(obj, entity);
    }
}

public class MockWeb: CustomApiController
{
    public override void GetWebsiteContent(WebsiteArgs args)
    {
        base.GetWebsiteContent(args);

        var frontEndUrl = ServiceLocator.GetService<IConfiguration>()["frontend:url"];
        if (!string.IsNullOrEmpty(frontEndUrl))
            args.Contents = args.Contents.Replace("https://unpkg.com/@vidyano/vidyano/index.min.js", frontEndUrl);
    }
}

public class Mock_AttributeActions(MockContext context) : PersistentObjectActions<MockContext, Mock_Attribute>(context)
{
    public override Mock_Attribute? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateAttribute(obj.ObjectId);
    }
}

public class Mock_Attribute
{
    public string Id { get; set; } = null!;

    [DataType(DataTypes.DropDown)]
    public string? DropDown { get; set; } = "Monday";

    [DataType(DataTypes.DropDown)]
    public string? DropDownRadio { get; set; } = "Tuesday";

    [DataType(DataTypes.DropDown)]
    public string? DropDownChip { get; set; } = "Wednesday";

    [DataType(DataTypes.DropDown)]
    public string? DropDownReadOnly { get; set; } = "Thursday";

    [DataType(DataTypes.DropDown)]
    public string? DropDownRequired { get; set; } = "";

    [DataType(DataTypes.DropDown)]
    public string? DropDownRadioHorizontal { get; set; } = "Friday";

    [DataType(DataTypes.DropDown)]
    public string? DropDownChipHorizontal { get; set; } = "Monday";
}
