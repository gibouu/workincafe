@preconcurrency import MapKit
import UIKit

struct PlaceAnnotationPayload: Hashable, Sendable {
    let id: String
    let coordinate: CLLocationCoordinate2D
    let name: String
    let categoryLabel: String
    let rating: Double?
    let presentationKey: String
    let symbolName: String
    let monogram: String?
    let backgroundHexColor: UInt32
    let foregroundStyle: PlacePresentation.Foreground

    init(place: PlaceSummary) {
        let presentation = place.presentation
        id = place.id
        coordinate = CLLocationCoordinate2D(
            latitude: place.latitude,
            longitude: place.longitude
        )
        name = place.name
        categoryLabel = place.categoryLabel
        rating = place.rating
        presentationKey = presentation.key
        symbolName = presentation.symbolName
        monogram = presentation.monogram
        backgroundHexColor = presentation.hexColor
        foregroundStyle = presentation.foreground
    }

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.id == rhs.id
            && lhs.coordinate.latitude == rhs.coordinate.latitude
            && lhs.coordinate.longitude == rhs.coordinate.longitude
            && lhs.name == rhs.name
            && lhs.categoryLabel == rhs.categoryLabel
            && lhs.rating == rhs.rating
            && lhs.presentationKey == rhs.presentationKey
            && lhs.symbolName == rhs.symbolName
            && lhs.monogram == rhs.monogram
            && lhs.backgroundHexColor == rhs.backgroundHexColor
            && lhs.foregroundStyle == rhs.foregroundStyle
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
        hasher.combine(coordinate.latitude)
        hasher.combine(coordinate.longitude)
        hasher.combine(name)
        hasher.combine(categoryLabel)
        hasher.combine(rating)
        hasher.combine(presentationKey)
        hasher.combine(symbolName)
        hasher.combine(monogram)
        hasher.combine(backgroundHexColor)
        hasher.combine(foregroundStyle)
    }
}

@MainActor
final class PlaceAnnotation: NSObject, @preconcurrency MKAnnotation {
    private(set) var payload: PlaceAnnotationPayload

    dynamic var coordinate: CLLocationCoordinate2D {
        payload.coordinate
    }

    init(payload: PlaceAnnotationPayload) {
        self.payload = payload
        super.init()
    }

    convenience init(place: PlaceSummary) {
        self.init(payload: PlaceAnnotationPayload(place: place))
    }

    func update(with place: PlaceSummary) {
        update(with: PlaceAnnotationPayload(place: place))
    }

    func update(with payload: PlaceAnnotationPayload) {
        let coordinateChanged = coordinate.latitude != payload.coordinate.latitude
            || coordinate.longitude != payload.coordinate.longitude
        if coordinateChanged {
            willChangeValue(forKey: #keyPath(MKAnnotation.coordinate))
        }
        self.payload = payload
        if coordinateChanged {
            didChangeValue(forKey: #keyPath(MKAnnotation.coordinate))
        }
    }
}

@MainActor
final class PlaceAnnotationView: MKAnnotationView {
    static let reuseIdentifier = "workincafe.place"
    static let normalDiameter: CGFloat = 32
    static let selectedDiameter: CGFloat = 42

    private let badgeLayer = CAShapeLayer()
    private let contentLabel = UILabel()
    private(set) var currentDiameter = normalDiameter

    override var annotation: (any MKAnnotation)? {
        didSet { configure() }
    }

    override init(annotation: (any MKAnnotation)?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        setUpView()
        configure()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setUpView()
        configure()
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        clusteringIdentifier = nil
        accessibilityIdentifier = nil
        accessibilityLabel = nil
        accessibilityHint = nil
        applySelection(false, animated: false)
        accessibilityValue = nil
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        updateGeometry()
    }

    override func setSelected(_ selected: Bool, animated: Bool) {
        super.setSelected(selected, animated: animated)
        applySelection(
            selected,
            animated: animated && !UIAccessibility.isReduceMotionEnabled
        )
    }

    func refresh() {
        configure()
    }

    private func setUpView() {
        backgroundColor = .clear
        collisionMode = .circle
        canShowCallout = false

        badgeLayer.lineWidth = 2
        badgeLayer.strokeColor = UIColor.white.cgColor
        layer.addSublayer(badgeLayer)

        contentLabel.textAlignment = .center
        contentLabel.adjustsFontSizeToFitWidth = true
        contentLabel.minimumScaleFactor = 0.7
        addSubview(contentLabel)

        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 2)
        layer.shadowRadius = 3
        layer.shadowOpacity = 0.16

        isAccessibilityElement = true
        accessibilityTraits = .button
        applySelection(false, animated: false)
    }

    private func configure() {
        guard let annotation = annotation as? PlaceAnnotation else {
            isHidden = true
            return
        }
        isHidden = false
        let payload = annotation.payload
        clusteringIdentifier = Self.reuseIdentifier
        accessibilityIdentifier = "map.place.\(payload.id)"
        displayPriority = .defaultHigh
        withoutLayerAnimation {
            badgeLayer.fillColor = UIColor(hex: payload.backgroundHexColor).cgColor
        }

        let rating = payload.rating.flatMap { value in
            value > 0 ? ", rated \(String(format: "%.1f", value))" : nil
        } ?? ""
        accessibilityLabel = "\(payload.name), \(payload.categoryLabel)\(rating)"
        accessibilityHint = "Shows details"
        applySelection(isSelected, animated: false)
    }

    private func applySelection(_ selected: Bool, animated: Bool) {
        let changes = { [self] in
            currentDiameter = selected ? Self.selectedDiameter : Self.normalDiameter
            displayPriority = selected ? .required : .defaultHigh
            accessibilityValue = selected ? "Selected" : "Not selected"
            if selected {
                accessibilityTraits.insert(.selected)
            } else {
                accessibilityTraits.remove(.selected)
            }
            bounds = CGRect(
                x: 0,
                y: 0,
                width: currentDiameter,
                height: currentDiameter
            )
            layer.shadowOpacity = selected ? 0.24 : 0.16
            layer.shadowRadius = selected ? 5 : 3
            updateGeometry()
            configureContent()
        }

        guard animated else {
            withoutLayerAnimation(changes)
            return
        }
        UIView.animate(
            withDuration: 0.2,
            delay: 0,
            options: [.allowUserInteraction, .beginFromCurrentState],
            animations: changes
        )
    }

    private func updateGeometry() {
        badgeLayer.frame = bounds
        badgeLayer.path = UIBezierPath(
            ovalIn: bounds.insetBy(dx: 1, dy: 1)
        ).cgPath
        contentLabel.frame = bounds.insetBy(dx: 5, dy: 5)
        layer.shadowPath = UIBezierPath(ovalIn: bounds).cgPath
    }

    private func configureContent() {
        guard let annotation = annotation as? PlaceAnnotation else { return }
        let payload = annotation.payload
        let foregroundColor: UIColor = payload.foregroundStyle == .light ? .white : .black
        contentLabel.textColor = foregroundColor
        if let monogram = payload.monogram {
            contentLabel.attributedText = nil
            contentLabel.text = monogram
            contentLabel.font = .systemFont(
                ofSize: currentDiameter * 0.33,
                weight: .bold
            )
        } else {
            contentLabel.text = nil
            let configuration = UIImage.SymbolConfiguration(
                pointSize: currentDiameter * 0.42,
                weight: .semibold
            )
            let image = UIImage(systemName: payload.symbolName, withConfiguration: configuration)?
                .withTintColor(foregroundColor, renderingMode: .alwaysOriginal)
            contentLabel.attributedText = image.map { image in
                NSAttributedString(attachment: NSTextAttachment(image: image))
            }
        }
    }
}

@MainActor
final class ClusterAnnotationView: MKAnnotationView {
    static let reuseIdentifier = "workincafe.cluster"

    private let badgeLayer = CAShapeLayer()
    private let contentLabel = UILabel()
    private(set) var currentDiameter: CGFloat = 34

    override var annotation: (any MKAnnotation)? {
        didSet { configure() }
    }

    override init(annotation: (any MKAnnotation)?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        setUpView()
        configure()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setUpView()
        configure()
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        accessibilityLabel = nil
        accessibilityHint = nil
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        updateGeometry()
    }

    static func diameter(for memberCount: Int) -> CGFloat {
        switch memberCount {
        case ...9: 34
        case ...99: 40
        default: 46
        }
    }

    private func setUpView() {
        backgroundColor = .clear
        collisionMode = .circle
        canShowCallout = false

        badgeLayer.fillColor = UIColor(hex: 0x353539).cgColor
        badgeLayer.strokeColor = UIColor.white.withAlphaComponent(0.9).cgColor
        badgeLayer.lineWidth = 2
        layer.addSublayer(badgeLayer)

        contentLabel.textAlignment = .center
        contentLabel.textColor = .white
        contentLabel.font = .monospacedDigitSystemFont(ofSize: 13, weight: .bold)
        addSubview(contentLabel)

        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 2)
        layer.shadowRadius = 3
        layer.shadowOpacity = 0.15

        displayPriority = .required
        isAccessibilityElement = true
        accessibilityTraits = .button
    }

    private func configure() {
        guard let cluster = annotation as? MKClusterAnnotation else {
            isHidden = true
            return
        }
        isHidden = false
        let count = cluster.memberAnnotations.count
        currentDiameter = Self.diameter(for: count)
        bounds = CGRect(x: 0, y: 0, width: currentDiameter, height: currentDiameter)
        contentLabel.text = "\(count)"
        accessibilityLabel = "\(count) work spots"
        accessibilityHint = "Zooms in"
        updateGeometry()
    }

    private func updateGeometry() {
        badgeLayer.frame = bounds
        badgeLayer.path = UIBezierPath(
            ovalIn: bounds.insetBy(dx: 1, dy: 1)
        ).cgPath
        contentLabel.frame = bounds
        layer.shadowPath = UIBezierPath(ovalIn: bounds).cgPath
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

private func withoutLayerAnimation(_ changes: () -> Void) {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    changes()
    CATransaction.commit()
}
